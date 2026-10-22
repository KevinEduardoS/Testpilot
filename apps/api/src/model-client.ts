import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { FastifyBaseLogger } from 'fastify';
import type { z } from 'zod';
import { HttpError } from './errors.js';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type ModelSettings = {
  client: Anthropic;
  model: string;
  effort: Effort;
  maxTokens: number;
};

export type ModelRequest<Schema extends z.ZodType> = {
  systemPrompt: string;
  userMessage: string;
  // Forma de la salida estructurada. Sin restricciones de longitud, que la salida estructurada
  // no admite: las reglas de negocio las valida quien llama.
  schema: Schema;
  // Identifica la operación en los logs.
  operation: string;
};

// refused: el modelo rechazó la petición por sus políticas de seguridad.
export type ModelOutcome<T> = { refused: true } | { refused: false; output: T };

// Del más específico al más general: las subclases de APIError deben ir antes que APIError.
const toHttpError = (error: unknown): unknown => {
  if (error instanceof Anthropic.RateLimitError) {
    return new HttpError(
      503,
      'ai_rate_limited',
      'El servicio de IA está saturado. Intenta más tarde.',
    );
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new HttpError(
      500,
      'ai_misconfigured',
      'La API no tiene credenciales válidas para la IA.',
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new HttpError(503, 'ai_unavailable', 'No se pudo conectar con el servicio de IA.');
  }
  if (error instanceof Anthropic.APIError) {
    return new HttpError(
      502,
      'ai_error',
      `El servicio de IA respondió con un error (${error.status}).`,
    );
  }
  return error;
};

export const invalidModelOutput = (message = 'La respuesta del modelo no cumple el esquema.') =>
  new HttpError(502, 'invalid_model_output', message);

const parseOutput = <Schema extends z.ZodType>(
  message: Anthropic.Beta.BetaMessage,
  schema: Schema,
): z.infer<Schema> => {
  const text = message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw invalidModelOutput();
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw invalidModelOutput();
  }
  return parsed.data;
};

export const callModel = async <Schema extends z.ZodType>(
  { client, model, effort, maxTokens }: ModelSettings,
  { systemPrompt, userMessage, schema, operation }: ModelRequest<Schema>,
  logger: FastifyBaseLogger,
): Promise<ModelOutcome<z.infer<Schema>>> => {
  let response;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: maxTokens,
      // Si el modelo rechaza la petición, la API la reintenta en otro modelo adecuado.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (error) {
    throw toHttpError(error);
  }

  logger.info(
    {
      operation,
      model: response.model,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens,
      cacheWriteTokens: response.usage.cache_creation_input_tokens,
    },
    'model call completed',
  );

  // stop_reason se revisa antes de parsear: una respuesta truncada o rechazada no es JSON válido.
  if (response.stop_reason === 'refusal') {
    return { refused: true };
  }
  if (response.stop_reason === 'max_tokens') {
    throw new HttpError(502, 'truncated_output', 'La respuesta del modelo quedó incompleta.');
  }
  return { refused: false, output: parseOutput(response, schema) };
};
