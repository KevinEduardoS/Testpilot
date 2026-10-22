import {
  bugReportSchema,
  diagnosisCategorySchema,
  type DiagnosisCategory,
  type ExecutionFailure,
  type RepairTestRequest,
  type RepairTestResponse,
} from '@testpilot/shared';
import { checkScriptPolicy, countAssertions } from '@testpilot/shared/script-policy';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { callModel, invalidModelOutput, type ModelSettings } from './model-client.js';
import { dataBlock } from './prompt-data.js';

// Forma que devuelve el modelo; las reglas de negocio se validan después en toResponse.
const modelOutputSchema = z.object({
  category: diagnosisCategorySchema,
  diagnosis: z.string(),
  outcome: z.enum(['fixed', 'bug_report']),
  title: z.string(),
  steps: z.array(z.string()),
  script: z.string(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  bug_report: z
    .object({
      title: z.string(),
      severity: bugReportSchema.shape.severity,
      steps_to_reproduce: z.array(z.string()),
      expected: z.string(),
      actual: z.string(),
    })
    .nullable(),
});

type ModelOutput = z.infer<typeof modelOutputSchema>;

export type TestRepairerOptions = ModelSettings & { systemPrompt: string };

export type TestRepairer = (
  request: RepairTestRequest,
  logger: FastifyBaseLogger,
) => Promise<RepairTestResponse>;

const REFUSAL_REASON = 'El modelo rechazó la solicitud por sus políticas de seguridad.';

// Fallos de la aplicación o del entorno: cambiar la prueba para que pase los ocultaría.
const NOT_FIXABLE: ReadonlySet<DiagnosisCategory> = new Set(['app_bug', 'environment']);

const describeFailure = ({ status, error, steps }: ExecutionFailure): string => {
  const lines = [`Estado: ${status}`, `Error: ${error ?? 'sin mensaje'}`, 'Pasos:'];
  if (steps.length === 0) {
    lines.push('(no se ejecutó ningún paso)');
  }
  steps.forEach((step, index) => {
    lines.push(`${index + 1}. [${step.status}] ${step.title} (${Math.round(step.durationMs)} ms)`);
    if (step.error !== null) {
      lines.push(`   Error: ${step.error}`);
    }
  });
  return lines.join('\n');
};

// Todo llega del cliente o de la página que falló: va delimitado y el prompt lo trata como datos.
const buildUserMessage = ({ instructions, script, failure }: RepairTestRequest): string =>
  [
    ...dataBlock(
      'instrucciones_usuario',
      instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n'),
    ),
    ...dataBlock('script_fallido', script),
    ...dataBlock('resultado_ejecucion', describeFailure(failure)),
    ...(failure.pageSnapshot === null
      ? ['No se pudo capturar el snapshot de la página.']
      : dataBlock('snapshot_pagina', failure.pageSnapshot)),
  ].join('\n');

const normalizeCode = (code: string) => code.replace(/\s+/g, ' ').trim();

const toResponse = (output: ModelOutput, originalScript: string): RepairTestResponse => {
  const diagnosis = { category: output.category, summary: output.diagnosis };

  if (output.outcome === 'bug_report') {
    if (output.bug_report === null) {
      throw invalidModelOutput('El modelo reportó un bug sin incluir el reporte.');
    }
    const { title, severity, steps_to_reproduce, expected, actual } = output.bug_report;
    return {
      status: 'bug_report',
      diagnosis,
      report: { title, severity, stepsToReproduce: steps_to_reproduce, expected, actual },
    };
  }

  if (NOT_FIXABLE.has(output.category)) {
    throw invalidModelOutput('El modelo intentó cambiar la prueba para ocultar un fallo real.');
  }
  const policy = checkScriptPolicy(output.script);
  if (!policy.ok) {
    throw new HttpError(
      502,
      'unsafe_script',
      'El script reparado no cumple la política de seguridad.',
      policy.violations,
    );
  }
  if (normalizeCode(output.script) === normalizeCode(originalScript)) {
    throw invalidModelOutput('El modelo devolvió el mismo script sin cambios.');
  }
  // Regla de oro: una reparación no puede quitar aserciones para que la prueba pase.
  const before = countAssertions(originalScript);
  const after = countAssertions(output.script);
  if (after < before) {
    throw new HttpError(
      502,
      'weakened_assertions',
      'La reparación propuesta quitaba aserciones de la prueba y se descartó.',
      [`aserciones antes: ${before}, después: ${after}`],
    );
  }

  const { title, steps, script, assumptions, warnings } = output;
  return { status: 'fixed', diagnosis, test: { title, steps, script, assumptions, warnings } };
};

export const createTestRepairer =
  ({ systemPrompt, ...settings }: TestRepairerOptions): TestRepairer =>
  async (request, logger) => {
    const outcome = await callModel(
      settings,
      {
        systemPrompt,
        userMessage: buildUserMessage(request),
        schema: modelOutputSchema,
        operation: 'repair-test',
      },
      logger,
    );
    return outcome.refused
      ? { status: 'rejected', reason: REFUSAL_REASON }
      : toResponse(outcome.output, request.script);
  };
