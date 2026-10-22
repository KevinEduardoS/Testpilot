import { apiErrorSchema, executionResultSchema, type ExecutionResult } from '@testpilot/shared';
import { HttpError } from './errors.js';

// Margen sobre el timeout de la prueba para el arranque del navegador y la respuesta del runner.
const RUNNER_OVERHEAD_MS = 30_000;

export type RunnerClientOptions = { runnerUrl: string; internalApiKey: string; runTimeoutMs: number };
export type TestExecutor = (script: string) => Promise<ExecutionResult>;

export const createRunnerClient =
  ({ runnerUrl, internalApiKey, runTimeoutMs }: RunnerClientOptions): TestExecutor =>
  async (script) => {
    let response: Response;
    let body: unknown;

    try {
      response = await fetch(`${runnerUrl}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-api-key': internalApiKey },
        body: JSON.stringify({ script }),
        signal: AbortSignal.timeout(runTimeoutMs + RUNNER_OVERHEAD_MS),
      });
      body = await response.json();
    } catch {
      throw new HttpError(503, 'runner_unavailable', 'No se pudo conectar con el runner.');
    }

    if (response.ok) {
      const result = executionResultSchema.safeParse(body);
      if (!result.success) {
        throw new HttpError(502, 'invalid_runner_response', 'El runner devolvió un resultado inválido.');
      }
      return result.data;
    }

    const error = apiErrorSchema.safeParse(body);
    if (error.success && (response.status === 422 || error.data.error === 'runner_busy')) {
      throw new HttpError(response.status, error.data.error, error.data.message, error.data.details);
    }
    // Cualquier otro fallo (incluido un 401 por clave mal configurada) es un error interno.
    throw new HttpError(502, 'runner_error', `El runner respondió con el estado ${response.status}.`);
  };
