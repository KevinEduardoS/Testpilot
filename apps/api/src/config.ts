import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// En local se lee el .env de la raíz; en Docker las variables llegan por entorno
// y tienen prioridad sobre el archivo.
const rootEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url));

try {
  process.loadEnvFile(rootEnvPath);
} catch (error) {
  const isMissingFile = error instanceof Error && 'code' in error && error.code === 'ENOENT';
  if (!isMissingFile) {
    throw error;
  }
}

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  RUNNER_URL: z.string().url().default('http://localhost:3002'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  INTERNAL_API_KEY: z.string().min(32, 'debe tener al menos 32 caracteres'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variables de entorno inválidas en api:\n${issues}`);
}

export const env = parsed.data;
