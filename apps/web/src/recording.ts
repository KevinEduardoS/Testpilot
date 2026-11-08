import {
  executionEventSchema,
  generateTestResponseSchema,
  repairTestResponseSchema,
} from '@testpilot/shared';
import { z } from 'zod';

// Grabación de respuestas reales de la API y del runner, para publicar la web sin servidor.
// La genera scripts/record-demo.ts contra una API local; la reproduce recorded-backend.ts.
// Cada respuesta se valida con el mismo contrato que usa la API en vivo.

export const RECORDING_URL = '/recordings/demo.json';

export const recordingSchema = z.object({
  recordedAt: z.string(),
  generations: z.array(
    z.object({
      instruction: z.string(),
      durationMs: z.number().min(0),
      response: generateTestResponseSchema,
    }),
  ),
  repairs: z.array(
    z.object({
      script: z.string(),
      durationMs: z.number().min(0),
      response: repairTestResponseSchema,
    }),
  ),
  executions: z.array(
    z.object({
      script: z.string(),
      // Momento de cada evento desde el inicio de la ejecución, para reproducir su ritmo real.
      events: z.array(z.object({ atMs: z.number().min(0), event: executionEventSchema })),
    }),
  ),
});

export type Recording = z.infer<typeof recordingSchema>;

export const normalizeInstruction = (text: string): string =>
  text.trim().replace(/\s+/g, ' ').toLowerCase();
