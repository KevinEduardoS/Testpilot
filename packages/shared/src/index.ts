import { z } from 'zod';

export const healthStatusSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const runnerPingSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export type RunnerPing = z.infer<typeof runnerPingSchema>;

export const generateTestRequestSchema = z.object({
  instruction: z.string().trim().min(1).max(1000),
  baseUrl: z.url({ protocol: /^https?$/ }).optional(),
});

export type GenerateTestRequest = z.infer<typeof generateTestRequestSchema>;

export const generatedTestSchema = z.object({
  title: z.string(),
  steps: z.array(z.string()),
  script: z.string(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type GeneratedTest = z.infer<typeof generatedTestSchema>;

export const generateTestResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), test: generatedTestSchema }),
  z.object({ status: z.literal('needs_clarification'), question: z.string() }),
  z.object({ status: z.literal('rejected'), reason: z.string() }),
]);

export type GenerateTestResponse = z.infer<typeof generateTestResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.string()).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const MAX_SCRIPT_LENGTH = 20_000;

export const executeTestRequestSchema = z.object({
  script: z.string().min(1).max(MAX_SCRIPT_LENGTH),
});

export type ExecuteTestRequest = z.infer<typeof executeTestRequestSchema>;

export const stepResultSchema = z.object({
  title: z.string(),
  status: z.enum(['passed', 'failed']),
  durationMs: z.number(),
  error: z.string().nullable(),
});

export type StepResult = z.infer<typeof stepResultSchema>;

export const executionResultSchema = z.object({
  status: z.enum(['passed', 'failed', 'timedOut', 'interrupted']),
  durationMs: z.number(),
  steps: z.array(stepResultSchema),
  error: z.string().nullable(),
  // Captura PNG del estado final de la página como data URL.
  screenshot: z.string().nullable(),
});

export type ExecutionResult = z.infer<typeof executionResultSchema>;
