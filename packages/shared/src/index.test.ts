import { describe, expect, it } from 'vitest';
import { allowedDomainsSchema, healthStatusSchema, isAllowedHost } from './index.js';

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

describe('allowedDomainsSchema', () => {
  it('interpreta "*" como cualquier dominio', () => {
    expect(allowedDomainsSchema.parse(' * ')).toBeNull();
  });

  it('normaliza la lista separada por comas', () => {
    expect(allowedDomainsSchema.parse('SauceDemo.com, example.org ,')).toEqual([
      'saucedemo.com',
      'example.org',
    ]);
  });

  it.each(['', 'https://saucedemo.com', '127.0.0.1', 'localhost', '*.saucedemo.com'])(
    'rechaza %j',
    (raw) => {
      expect(allowedDomainsSchema.safeParse(raw).success).toBe(false);
    },
  );
});

describe('isAllowedHost', () => {
  const domains = ['saucedemo.com'];

  it('acepta el dominio, sus subdominios y el punto final', () => {
    expect(isAllowedHost('saucedemo.com', domains)).toBe(true);
    expect(isAllowedHost('www.SauceDemo.com.', domains)).toBe(true);
  });

  it('rechaza dominios que solo terminan igual', () => {
    expect(isAllowedHost('evilsaucedemo.com', domains)).toBe(false);
    expect(isAllowedHost('saucedemo.com.evil.example', domains)).toBe(false);
  });

  it('acepta cualquier host sin lista', () => {
    expect(isAllowedHost('example.com', null)).toBe(true);
  });
});
