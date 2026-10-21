import { z } from 'zod';

// Solo las variables con prefijo VITE_ llegan al navegador; los secretos nunca deben usar ese prefijo.
const envSchema = z.object({
  VITE_API_URL: z.url().default('http://localhost:3001'),
});

export const env = envSchema.parse(import.meta.env);
