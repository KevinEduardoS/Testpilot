import {
  apiErrorSchema,
  appInfoSchema,
  executionResultSchema,
  generateTestResponseSchema,
  healthStatusSchema,
  runnerPingSchema,
  type ApiError,
  type AppInfo,
  type ExecuteTestRequest,
  type ExecutionResult,
  type GenerateTestRequest,
  type GenerateTestResponse,
} from '@testpilot/shared';
import type { z } from 'zod';
import { env } from './config';

const REQUEST_TIMEOUT_MS = 5000;
// La generación con IA puede tardar; el SDK de la API reintenta antes de rendirse.
const GENERATE_TIMEOUT_MS = 180_000;
// Incluye el arranque del navegador y el timeout de la prueba en el runner.
const EXECUTE_TIMEOUT_MS = 150_000;

const fetchJson = async (path: string): Promise<unknown> => {
  const response = await fetch(`${env.VITE_API_URL}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return response.json();
};

export const isApiUp = async (): Promise<boolean> => {
  try {
    healthStatusSchema.parse(await fetchJson('/health'));
    return true;
  } catch {
    return false;
  }
};

export const getAppInfo = async (): Promise<AppInfo | null> => {
  try {
    return appInfoSchema.parse(await fetchJson('/api/info'));
  } catch {
    return null;
  }
};

// El navegador nunca habla con el runner: la API comprueba su estado y lo reporta.
// Devuelve null si la API no responde, porque entonces el estado del runner es desconocido.
export const isRunnerUp = async (): Promise<boolean | null> => {
  try {
    return runnerPingSchema.parse(await fetchJson('/api/ping')).ok;
  } catch {
    return null;
  }
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export type GenerateResult = ApiResult<GenerateTestResponse>;
export type ExecuteResult = ApiResult<ExecutionResult>;

const failure = (error: string, message: string): { ok: false; error: ApiError } => ({
  ok: false,
  error: { error, message },
});

const postJson = async <T>(
  path: string,
  input: unknown,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<ApiResult<T>> => {
  let response: Response;
  let body: unknown;

  try {
    response = await fetch(`${env.VITE_API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return failure('timeout', 'La operación tardó demasiado. Intenta de nuevo.');
    }
    return failure('network_error', 'No se pudo conectar con la API.');
  }

  if (response.ok) {
    const parsed = schema.safeParse(body);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : failure('invalid_response', 'La API devolvió una respuesta con un formato inesperado.');
  }

  const parsedError = apiErrorSchema.safeParse(body);
  return parsedError.success
    ? { ok: false, error: parsedError.data }
    : failure('unexpected_response', `La API respondió con el estado ${response.status}.`);
};

export const generateTest = (input: GenerateTestRequest): Promise<GenerateResult> =>
  postJson('/api/tests/generate', input, generateTestResponseSchema, GENERATE_TIMEOUT_MS);

export const executeTest = (input: ExecuteTestRequest): Promise<ExecuteResult> =>
  postJson('/api/tests/execute', input, executionResultSchema, EXECUTE_TIMEOUT_MS);
