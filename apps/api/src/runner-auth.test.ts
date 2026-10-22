import { describe, expect, it } from 'vitest';
import { createRunnerHeaders } from './runner-auth.js';

const KEY = 'k'.repeat(32);

const metadataServer = (responses: Response[]) => {
  const requests: { url: string; headers: Headers }[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init?.headers) });
    const response = responses.shift();
    if (response === undefined) {
      throw new Error('sin respuesta');
    }
    return response;
  };
  return { requests, fetchFn };
};

describe('createRunnerHeaders', () => {
  it('envía solo la clave interna en modo internal-key', async () => {
    const headers = createRunnerHeaders({
      auth: 'internal-key',
      internalApiKey: KEY,
      runnerUrl: 'http://localhost:3002',
    });
    await expect(headers()).resolves.toEqual({ 'x-internal-api-key': KEY });
  });

  it('añade el token de identidad pedido para la URL del runner y lo reutiliza', async () => {
    const { requests, fetchFn } = metadataServer([
      new Response('token-1\n'),
      new Response('token-2'),
    ]);
    let now = 0;
    const headers = createRunnerHeaders({
      auth: 'google-id-token',
      internalApiKey: KEY,
      runnerUrl: 'https://runner-abc.a.run.app',
      fetchFn,
      now: () => now,
    });

    await expect(headers()).resolves.toEqual({
      'x-internal-api-key': KEY,
      authorization: 'Bearer token-1',
    });
    await headers();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain('audience=https%3A%2F%2Frunner-abc.a.run.app');
    expect(requests[0]?.headers.get('metadata-flavor')).toBe('Google');

    // Pasados 50 minutos se pide uno nuevo.
    now = 50 * 60 * 1000;
    await expect(headers()).resolves.toMatchObject({ authorization: 'Bearer token-2' });
  });

  it.each([
    ['el servidor de metadatos responde con error', [new Response('no', { status: 404 })]],
    ['el servidor de metadatos no responde', []],
  ])('responde runner_unavailable si %s', async (_name, responses) => {
    const { fetchFn } = metadataServer(responses);
    const headers = createRunnerHeaders({
      auth: 'google-id-token',
      internalApiKey: KEY,
      runnerUrl: 'https://runner-abc.a.run.app',
      fetchFn,
    });
    await expect(headers()).rejects.toMatchObject({ statusCode: 503, code: 'runner_unavailable' });
  });
});
