import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
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

// Modelos que aceptan fallbacks: "default" (reintento en otro modelo si el primero rechaza la petición).
export const SUPPORTED_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-opus-5',
  'claude-fable-5-1',
] as const;

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  RUNNER_URL: z.url().default('http://localhost:3002'),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  INTERNAL_API_KEY: z.string().min(32, 'debe tener al menos 32 caracteres'),
  ANTHROPIC_API_KEY: z.string().min(1, 'es obligatoria'),
  ANTHROPIC_MODEL: z.enum(SUPPORTED_MODELS).default('claude-opus-5-5'),
  AI_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(16_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse({ ...readRootEnvFile(), ...process.env });

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variables de entorno inválidas en api:\n${issues}`);
}

export const env = parsed.data;
