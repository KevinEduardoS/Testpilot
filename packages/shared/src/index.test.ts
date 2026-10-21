import { describe, expect, it } from 'vitest';
import { healthStatusSchema } from './index.js';

describe('healthStatusSchema', () => {
  it('accepts a valid health payload', () => {
    const result = healthStatusSchema.parse({
      status: 'ok',
      service: 'api',
      timestamp: '2026-10-09T00:00:00.000Z',
    });

    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
  });
});
