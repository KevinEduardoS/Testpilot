import type {
  ApiError,
  ExecuteTestRequest,
  ExecutionEvent,
  GenerateTestRequest,
  RepairTestRequest,
} from '@testpilot/shared';
import type { GenerateResult, RepairResult } from './api';
import { normalizeInstruction, RECORDING_URL, recordingSchema, type Recording } from './recording';

// Reproduce la grabación en lugar de llamar a la API. Las esperas imitan la duración real.

// Tope de espera para respuestas que en la grabación tardaron mucho, como una generación con IA.
const MAX_RESPONSE_DELAY_MS = 1500;

const NOT_RECORDED: ApiError = {
  error: 'not_recorded',
  message:
    'Esta versión publicada reproduce ejecuciones grabadas: solo están disponibles los ejemplos.',
};

let recording: Promise<Recording> | null = null;

export const loadRecording = (fetchFn: typeof fetch = fetch): Promise<Recording> => {
  recording ??= fetchFn(RECORDING_URL)
    .then((response) => response.json())
    .then((json) => recordingSchema.parse(json))
    .catch((error: unknown) => {
      recording = null;
      throw error;
    });
  return recording;
};

const unavailable = (): ApiError => ({
  error: 'recording_unavailable',
  message: 'No se pudo cargar la grabación de la demo.',
});

export const wait = (ms: number, signal?: AbortSignal): Promise<boolean> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export const recordedGenerate = async (input: GenerateTestRequest): Promise<GenerateResult> => {
  let data: Recording;
  try {
    data = await loadRecording();
  } catch {
    return { ok: false, error: unavailable() };
  }
  const entry = data.generations.find(
    (generation) =>
      normalizeInstruction(generation.instruction) === normalizeInstruction(input.instruction),
  );
  if (entry === undefined) {
    return { ok: false, error: NOT_RECORDED };
  }
  await wait(Math.min(entry.durationMs, MAX_RESPONSE_DELAY_MS));
  return { ok: true, data: entry.response };
};

export const recordedRepair = async (input: RepairTestRequest): Promise<RepairResult> => {
  let data: Recording;
  try {
    data = await loadRecording();
  } catch {
    return { ok: false, error: unavailable() };
  }
  const entry = data.repairs.find((repair) => repair.script === input.script);
  if (entry === undefined) {
    return { ok: false, error: NOT_RECORDED };
  }
  await wait(Math.min(entry.durationMs, MAX_RESPONSE_DELAY_MS));
  return { ok: true, data: entry.response };
};

// Igual que la ejecución en vivo: el último evento es siempre result o error.
export const recordedExecution = async (
  input: ExecuteTestRequest,
  onEvent: (event: ExecutionEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
  let data: Recording;
  try {
    data = await loadRecording();
  } catch {
    onEvent({ type: 'error', error: unavailable() });
    return;
  }
  const entry = data.executions.find((execution) => execution.script === input.script);
  if (entry === undefined) {
    onEvent({ type: 'error', error: NOT_RECORDED });
    return;
  }
  let elapsed = 0;
  for (const { atMs, event } of entry.events) {
    if (!(await wait(atMs - elapsed, signal))) {
      return;
    }
    elapsed = atMs;
    onEvent(event);
  }
};
