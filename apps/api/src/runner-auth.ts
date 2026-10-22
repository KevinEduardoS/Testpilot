import { HttpError } from './errors.js';

// Cómo se autentica la API ante el runner. La clave interna se envía siempre. En Cloud Run el
// runner además es privado: solo acepta peticiones con un token de identidad de Google de una
// cuenta autorizada, que la API obtiene del servidor de metadatos.
export type RunnerAuth = 'internal-key' | 'google-id-token';

export type RunnerHeaders = () => Promise<Record<string, string>>;

const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
const METADATA_TIMEOUT_MS = 3000;
// Los tokens duran una hora; se renuevan antes para no enviar uno a punto de caducar.
const TOKEN_REUSE_MS = 50 * 60 * 1000;

type RunnerHeadersOptions = {
  auth: RunnerAuth;
  internalApiKey: string;
  // Audiencia del token: la URL del servicio del runner.
  runnerUrl: string;
  fetchFn?: typeof fetch;
  now?: () => number;
};

export const createRunnerHeaders = ({
  auth,
  internalApiKey,
  runnerUrl,
  fetchFn = fetch,
  now = Date.now,
}: RunnerHeadersOptions): RunnerHeaders => {
  const base = { 'x-internal-api-key': internalApiKey };
  if (auth === 'internal-key') {
    return async () => base;
  }

  let cached: { token: string; expiresAt: number } | null = null;

  const fetchToken = async (): Promise<string> => {
    const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(runnerUrl)}`;
    let response: Response;
    try {
      response = await fetchFn(url, {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      });
    } catch {
      throw new HttpError(503, 'runner_unavailable', 'No se pudo autenticar ante el runner.');
    }
    const token = response.ok ? (await response.text()).trim() : '';
    if (token === '') {
      throw new HttpError(503, 'runner_unavailable', 'No se pudo autenticar ante el runner.');
    }
    return token;
  };

  return async () => {
    if (cached === null || now() >= cached.expiresAt) {
      cached = { token: await fetchToken(), expiresAt: now() + TOKEN_REUSE_MS };
    }
    return { ...base, authorization: `Bearer ${cached.token}` };
  };
};
