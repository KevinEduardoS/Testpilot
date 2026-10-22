import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { allowedDomainsSchema, MAX_PAGE_SNAPSHOT_LENGTH } from '@testpilot/shared';
import { z } from 'zod';

const rootEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url));

// En local se lee el .env de la raíz; en Docker no existe y las variables llegan por entorno.
// No se vuelca en process.env: el schema descarta todo lo que este servicio no necesita.
const readRootEnvFile = (): Record<string, string | undefined> => {
  try {
    return parseEnv(readFileSync(rootEnvPath, 'utf8'));
  } catch (error) {
    const isMissingFile = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    if (isMissingFile) {
      return {};
    }
    throw error;
  }
};

const envSchema = z.object({
  RUNNER_PORT: z.coerce.number().int().positive().default(3002),
  RUN_TIMEOUT_MS: z.coerce.number().int().positive().max(300_000).default(60_000),
  INTERNAL_API_KEY: z.string().min(32, 'debe tener al menos 32 caracteres'),
  ALLOWED_DOMAINS: z.string().default('saucedemo.com').pipe(allowedDomainsSchema),
  SNAPSHOT_MAX_CHARS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(MAX_PAGE_SNAPSHOT_LENGTH)
    .default(MAX_PAGE_SNAPSHOT_LENGTH),
});

const parsed = envSchema.safeParse({ ...readRootEnvFile(), ...process.env });

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variables de entorno inválidas en runner:\n${issues}`);
}

export const env = parsed.data;
