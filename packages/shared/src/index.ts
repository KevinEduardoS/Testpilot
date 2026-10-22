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
