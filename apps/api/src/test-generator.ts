import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { GenerateTestRequest, GenerateTestResponse } from '@testpilot/shared';
import { checkScriptPolicy } from '@testpilot/shared/script-policy';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { HttpError } from './errors.js';

// Forma que devuelve el modelo. Sin restricciones de longitud porque la salida estructurada
// no las admite; las reglas de negocio se validan después en toResponse.
const modelOutputSchema = z.object({
  status: z.enum(['ok', 'needs_clarification', 'rejected']),
  title: z.string(),
  steps: z.array(z.string()),
  script: z.string(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  clarifying_question: z.string().nullable(),
  rejection_reason: z.string().nullable(),
});

type ModelOutput = z.infer<typeof modelOutputSchema>;

const outputFormat = betaZodOutputFormat(modelOutputSchema);

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type TestGeneratorOptions = {
  client: Anthropic;
  systemPrompt: string;
  model: string;
  effort: Effort;
  maxTokens: number;
};

export type TestGenerator = (
  request: GenerateTestRequest,
  logger: FastifyBaseLogger,
) => Promise<GenerateTestResponse>;

const REFUSAL_REASON = 'El modelo rechazó la solicitud por sus políticas de seguridad.';
const DEFAULT_REJECTION_REASON = 'La instrucción no cumple las políticas de uso.';

const buildUserMessage = ({ instruction, baseUrl, context }: GenerateTestRequest): string => {
  const parts: string[] = [];

  // En un refinamiento el modelo recibe el script vigente y lo que ya se pidió; todo llega
  // desde el cliente, así que va delimitado y el prompt lo trata como datos.
  if (context !== undefined) {
    parts.push(
      '<instrucciones_anteriores>',
      ...context.previousInstructions.map((previous, index) => `${index + 1}. ${previous}`),
      '</instrucciones_anteriores>',
      '<script_actual>',
      context.currentScript,
      '</script_actual>',
    );
  }

  parts.push(
    '<instruccion_usuario>',
    instruction,
    '</instruccion_usuario>',
    baseUrl === undefined ? 'No se indicó URL base.' : `<base_url>${baseUrl}</base_url>`,
  );
  return parts.join('\n');
};

const toResponse = (output: ModelOutput): GenerateTestResponse => {
  switch (output.status) {
    case 'needs_clarification':
      if (!output.clarifying_question) {
        throw new HttpError(
          502,
          'invalid_model_output',
          'El modelo pidió una aclaración sin incluir la pregunta.',
        );
      }
      return { status: 'needs_clarification', question: output.clarifying_question };

    case 'rejected':
      return { status: 'rejected', reason: output.rejection_reason || DEFAULT_REJECTION_REASON };

    case 'ok': {
      const policy = checkScriptPolicy(output.script);
      if (!policy.ok) {
        throw new HttpError(
          502,
          'unsafe_script',
          'El script generado no cumple la política de seguridad.',
          policy.violations,
        );
      }
      const { title, steps, script, assumptions, warnings } = output;
      return { status: 'ok', test: { title, steps, script, assumptions, warnings } };
    }
  }
};

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

const invalidOutput = () =>
  new HttpError(502, 'invalid_model_output', 'La respuesta del modelo no cumple el esquema.');

const parseModelOutput = (message: Anthropic.Beta.BetaMessage): ModelOutput => {
  const text = message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw invalidOutput();
  }
  const parsed = modelOutputSchema.safeParse(json);
  if (!parsed.success) {
    throw invalidOutput();
  }
  return parsed.data;
};

export const createTestGenerator =
  ({ client, systemPrompt, model, effort, maxTokens }: TestGeneratorOptions): TestGenerator =>
  async (request, logger) => {
    let response;
    try {
      response = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        // Si el modelo rechaza la petición, la API la reintenta en otro modelo adecuado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort, format: outputFormat },
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserMessage(request) }],
      });
    } catch (error) {
      throw toHttpError(error);
    }

    logger.info(
      {
        model: response.model,
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens,
        cacheWriteTokens: response.usage.cache_creation_input_tokens,
      },
      'test generation completed',
    );

    // stop_reason se revisa antes de parsear: una respuesta truncada o rechazada no es JSON válido.
    if (response.stop_reason === 'refusal') {
      return { status: 'rejected', reason: REFUSAL_REASON };
    }
    if (response.stop_reason === 'max_tokens') {
      throw new HttpError(502, 'truncated_output', 'La respuesta del modelo quedó incompleta.');
    }
    return toResponse(parseModelOutput(response));
  };
