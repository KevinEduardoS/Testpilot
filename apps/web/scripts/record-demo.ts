// Graba respuestas reales de la API y del runner para publicar la web sin servidor.
//   1. npm run dev                       (API en modo demo y runner con Chromium)
//   2. npm run record:demo --workspace apps/web
// Escribe public/recordings/demo.json y una captura PNG por ejecución.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import {
  EXAMPLES,
  generateTestResponseSchema,
  repairTestResponseSchema,
  type ExecutionEvent,
  type ExecutionResult,
} from '@testpilot/shared';
import { readExecutionEvents } from '@testpilot/shared/execution-stream';
import { toExecutionFailure } from '../src/execution';
import { recordingSchema, type Recording } from '../src/recording';

const API_URL = process.env.RECORD_API_URL ?? 'http://localhost:3001';
const OUTPUT_DIR = new URL('../public/recordings/', import.meta.url);

const post = async (path: string, body: unknown): Promise<Response> => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${path} respondió ${response.status}: ${await response.text()}`);
  }
  return response;
};

const timed = async <T>(task: () => Promise<T>): Promise<{ value: T; durationMs: number }> => {
  const startedAt = performance.now();
  const value = await task();
  return { value, durationMs: Math.round(performance.now() - startedAt) };
};

let screenshotCount = 0;

// Guarda la captura como archivo: incrustada en el JSON lo haría pesar varios megas.
const extractScreenshot = async (result: ExecutionResult): Promise<ExecutionResult> => {
  if (result.screenshot === null) {
    return result;
  }
  screenshotCount += 1;
  const name = `screenshot-${screenshotCount}.png`;
  const base64 = result.screenshot.replace(/^data:image\/png;base64,/, '');
  await writeFile(new URL(name, OUTPUT_DIR), Buffer.from(base64, 'base64'));
  return { ...result, screenshot: `/recordings/${name}` };
};

// Lee el stream evento a evento y guarda cuándo llegó cada uno, para reproducir el ritmo real.
const recordExecution = async (script: string) => {
  const startedAt = performance.now();
  const response = await post('/api/tests/execute', { script });
  if (response.body === null) {
    throw new Error('La API no devolvió eventos');
  }
  const events: { atMs: number; event: ExecutionEvent }[] = [];
  for await (const event of readExecutionEvents(response.body)) {
    events.push({ atMs: Math.round(performance.now() - startedAt), event });
  }

  const last = events.at(-1);
  if (last?.event.type !== 'result') {
    throw new Error(`La ejecución terminó sin resultado: ${JSON.stringify(last?.event)}`);
  }
  const result = await extractScreenshot(last.event.result);
  events[events.length - 1] = { atMs: last.atMs, event: { type: 'result', result } };
  return { script, events, result };
};

const main = async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const recording: Recording = {
    recordedAt: new Date().toISOString(),
    generations: [],
    repairs: [],
    executions: [],
  };

  for (const example of EXAMPLES) {
    const generation = await timed(async () =>
      generateTestResponseSchema.parse(
        await (
          await post('/api/tests/generate', {
            instruction: example.instruction,
            baseUrl: example.baseUrl,
          })
        ).json(),
      ),
    );
    recording.generations.push({
      instruction: example.instruction,
      durationMs: generation.durationMs,
      response: generation.value,
    });
    if (generation.value.status !== 'ok') {
      throw new Error(`${example.id}: la API no generó una prueba`);
    }

    const { script } = generation.value.test;
    const execution = await recordExecution(script);
    recording.executions.push({ script, events: execution.events });
    console.log(`${example.id}: ${execution.result.status}`);

    const failure = toExecutionFailure(execution.result);
    if (failure === null) {
      continue;
    }
    const repair = await timed(async () =>
      repairTestResponseSchema.parse(
        await (
          await post('/api/tests/repair', { instructions: [example.instruction], script, failure })
        ).json(),
      ),
    );
    recording.repairs.push({ script, durationMs: repair.durationMs, response: repair.value });
    console.log(`  reparación: ${repair.value.status}`);

    if (repair.value.status === 'fixed') {
      const fixed = await recordExecution(repair.value.test.script);
      recording.executions.push({ script: repair.value.test.script, events: fixed.events });
      console.log(`  versión reparada: ${fixed.result.status}`);
    }
  }

  await writeFile(
    new URL('demo.json', OUTPUT_DIR),
    JSON.stringify(recordingSchema.parse(recording)),
  );
  console.log(
    `Grabación lista: ${recording.executions.length} ejecuciones, ${screenshotCount} capturas.`,
  );
};

await main();
