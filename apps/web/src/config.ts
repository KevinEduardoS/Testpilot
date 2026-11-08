import { z } from 'zod';

// Solo las variables con prefijo VITE_ llegan al navegador; los secretos nunca deben usar ese prefijo.
const envSchema = z.object({
  VITE_API_URL: z.url().default('http://localhost:3001'),
  // live: API y runner reales. recorded: reproduce ejecuciones grabadas, sin servidor.
  VITE_BACKEND: z.enum(['live', 'recorded']).default('live'),
});

export const env = envSchema.parse(import.meta.env);

export const isRecordedBackend = env.VITE_BACKEND === 'recorded';
