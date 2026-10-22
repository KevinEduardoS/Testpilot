import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { withDemoFallback } from './demo-fallback.js';
import { HttpError } from './errors.js';

const logger = pino({ level: 'silent' });
const budgetError = new HttpError(503, 'ai_budget_exhausted', 'sin presupuesto');
const fail = (error: unknown) => async (): Promise<string> => {
  throw error;
};

describe('withDemoFallback', () => {
  it('usa la IA mientras haya presupuesto', async () => {
    const service = withDemoFallback(
      async () => 'ia',
      async () => 'demo',
    );
    await expect(service('x', logger)).resolves.toBe('ia');
  });

  it('responde con la demo cuando se agota el presupuesto', async () => {
    const service = withDemoFallback(fail(budgetError), async () => 'demo');
    await expect(service('x', logger)).resolves.toBe('demo');
  });

  it('mantiene el error del presupuesto si la demo no conoce la petición', async () => {
    const demoError = new HttpError(503, 'demo_mode', 'no es un ejemplo');
    const service = withDemoFallback(fail(budgetError), fail(demoError));
    await expect(service('x', logger)).rejects.toBe(budgetError);
  });

  it('no oculta otros errores de la IA', async () => {
    const aiError = new HttpError(502, 'ai_error', 'fallo');
    const service = withDemoFallback(fail(aiError), async () => 'demo');
    await expect(service('x', logger)).rejects.toBe(aiError);
  });
});
