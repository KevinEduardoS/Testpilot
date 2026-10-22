import type { GenerateTestRequest, GenerateTestResponse } from '@testpilot/shared';
import { checkScriptPolicy } from '@testpilot/shared/script-policy';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { callModel, invalidModelOutput, type ModelSettings } from './model-client.js';

// Forma que devuelve el modelo; las reglas de negocio se validan después en toResponse.
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

export type TestGeneratorOptions = ModelSettings & { systemPrompt: string };

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
        throw invalidModelOutput('El modelo pidió una aclaración sin incluir la pregunta.');
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

export const createTestGenerator =
  ({ systemPrompt, ...settings }: TestGeneratorOptions): TestGenerator =>
  async (request, logger) => {
    const outcome = await callModel(
      settings,
      {
        systemPrompt,
        userMessage: buildUserMessage(request),
        schema: modelOutputSchema,
        operation: 'generate-test',
      },
      logger,
    );
    return outcome.refused
      ? { status: 'rejected', reason: REFUSAL_REASON }
      : toResponse(outcome.output);
  };
