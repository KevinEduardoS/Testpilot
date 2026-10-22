import { apiErrorSchema, executionEventSchema, type ExecutionEvent } from '@testpilot/shared';
import { HttpError } from './errors.js';

// Margen sobre el timeout de la prueba para el arranque del navegador y la respuesta del runner.
const RUNNER_OVERHEAD_MS = 30_000;

export type RunnerClientOptions = {
  runnerUrl: string;
  internalApiKey: string;
  runTimeoutMs: number;
};

// Resuelve cuando el runner acepta la ejecución; los errores previos (política, runner ocupado,
// red) se lanzan como HttpError. Los eventos nunca lanzan: un fallo a mitad de camino llega
// como evento "error", y el iterable siempre termina con "result" o "error".
export type TestExecutor = (
  script: string,
  signal: AbortSignal,
) => Promise<AsyncIterable<ExecutionEvent>>;

const streamError = (error: string, message: string): ExecutionEvent => ({
  type: 'error',
  error: { error, message },
});

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncIterable<ExecutionEvent> {
  let buffer = '';
  try {
    for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (line === '') {
          continue;
        }

        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch {
          yield streamError('invalid_runner_response', 'El runner envió un evento inválido.');
          return;
        }
        const event = executionEventSchema.safeParse(json);
        if (!event.success) {
          yield streamError('invalid_runner_response', 'El runner envió un evento inválido.');
          return;
        }
        yield event.data;
        if (event.data.type === 'result' || event.data.type === 'error') {
          return;
        }
      }
    }
  } catch {
    yield streamError('runner_unavailable', 'Se perdió la conexión con el runner.');
    return;
  }
  yield streamError('runner_error', 'El runner cerró la conexión sin un resultado.');
}

export const createRunnerClient =
  ({ runnerUrl, internalApiKey, runTimeoutMs }: RunnerClientOptions): TestExecutor =>
  async (script, signal) => {
    let response: Response;
    try {
      response = await fetch(`${runnerUrl}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-api-key': internalApiKey },
        body: JSON.stringify({ script }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(runTimeoutMs + RUNNER_OVERHEAD_MS)]),
      });
    } catch {
      throw new HttpError(503, 'runner_unavailable', 'No se pudo conectar con el runner.');
    }

    if (response.ok && response.body !== null) {
      return readEvents(response.body);
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Sin cuerpo JSON: se trata igual que cualquier otra respuesta inesperada.
    }
    const error = apiErrorSchema.safeParse(body);
    if (error.success && (response.status === 422 || error.data.error === 'runner_busy')) {
      throw new HttpError(
        response.status,
        error.data.error,
        error.data.message,
        error.data.details,
      );
    }
    // Cualquier otro fallo (incluido un 401 por clave mal configurada) es un error interno.
    throw new HttpError(
      502,
      'runner_error',
      `El runner respondió con el estado ${response.status}.`,
    );
  };
