import { apiErrorSchema, type ExecutionEvent } from '@testpilot/shared';
import { readExecutionEvents } from '@testpilot/shared/execution-stream';
import { HttpError } from './errors.js';
import type { RunnerHeaders } from './runner-auth.js';

// Margen sobre el timeout de la prueba para el arranque del navegador y la respuesta del runner.
const RUNNER_OVERHEAD_MS = 30_000;

export type RunnerClientOptions = {
  runnerUrl: string;
  runnerHeaders: RunnerHeaders;
  runTimeoutMs: number;
};

// Resuelve cuando el runner acepta la ejecución; los errores previos (política, runner ocupado,
// red) se lanzan como HttpError. Los eventos nunca lanzan: un fallo a mitad de camino llega
// como evento "error", y el iterable siempre termina con "result" o "error".
export type TestExecutor = (
  script: string,
  signal: AbortSignal,
) => Promise<AsyncIterable<ExecutionEvent>>;

export const createRunnerClient =
  ({ runnerUrl, runnerHeaders, runTimeoutMs }: RunnerClientOptions): TestExecutor =>
  async (script, signal) => {
    const headers = await runnerHeaders();
    let response: Response;
    try {
      response = await fetch(`${runnerUrl}/execute`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ script }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(runTimeoutMs + RUNNER_OVERHEAD_MS)]),
      });
    } catch {
      throw new HttpError(503, 'runner_unavailable', 'No se pudo conectar con el runner.');
    }

    if (response.ok && response.body !== null) {
      return readExecutionEvents(response.body);
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
