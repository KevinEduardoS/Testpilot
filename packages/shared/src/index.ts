import { z } from 'zod';

export const healthStatusSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const runCreateSchema = z.object({
  instruction: z.string().min(1).max(1000),
  baseUrl: z.string().url().optional(),
});

export type RunCreateInput = z.infer<typeof runCreateSchema>;
