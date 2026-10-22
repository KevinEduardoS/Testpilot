import { describe, expect, it } from 'vitest';
import { createAiBudget } from './ai-budget.js';

const usage = (tokens: number) => ({
  input_tokens: tokens,
  output_tokens: 0,
  cache_creation_input_tokens: null,
  cache_read_input_tokens: null,
});

describe('createAiBudget', () => {
  it('permite llamadas hasta agotar el presupuesto, contando todos los tokens', () => {
    const budget = createAiBudget({ dailyTokens: 100 });
    budget.record({
      input_tokens: 40,
      output_tokens: 30,
      cache_creation_input_tokens: 20,
      cache_read_input_tokens: 9,
    });
    expect(() => budget.assertAvailable()).not.toThrow();

    budget.record(usage(1));
    expect(() => budget.assertAvailable()).toThrow(
      expect.objectContaining({ statusCode: 503, code: 'ai_budget_exhausted' }),
    );
  });

  it('se reinicia al cambiar el día en UTC', () => {
    let now = new Date('2026-10-22T23:59:00Z');
    const budget = createAiBudget({ dailyTokens: 10, now: () => now });
    budget.record(usage(10));
    expect(() => budget.assertAvailable()).toThrow();

    now = new Date('2026-10-23T00:00:30Z');
    expect(() => budget.assertAvailable()).not.toThrow();
  });
});
