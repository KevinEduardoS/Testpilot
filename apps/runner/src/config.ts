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
  RUNNER_PORT: z.coerce.number().int().positive().default(3002),
  INTERNAL_API_KEY: z.string().min(32, 'debe tener al menos 32 caracteres'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variables de entorno inválidas en runner:\n${issues}`);
}

export const env = parsed.data;
