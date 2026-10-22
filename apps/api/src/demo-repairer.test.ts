import type { RepairTestRequest } from '@testpilot/shared';
import { checkScriptPolicy, countAssertions } from '@testpilot/shared/script-policy';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { demoTest } from './demo-generator.js';
import { createDemoRepairer } from './demo-repairer.js';

const repair = createDemoRepairer();
const logger = pino({ level: 'silent' });

const requestFor = (script: string): RepairTestRequest => ({
  instructions: ['instrucción'],
  script,
  failure: { status: 'failed', error: 'falló', steps: [], pageSnapshot: null },
});

describe('createDemoRepairer', () => {
  it('corrige el selector del ejemplo del catálogo sin quitar aserciones', async () => {
    const original = demoTest('catalog-title').script;
    const response = await repair(requestFor(original), logger);

    expect(response).toMatchObject({ status: 'fixed', diagnosis: { category: 'selector' } });
    if (response.status === 'fixed') {
      expect(checkScriptPolicy(response.test.script)).toEqual({ ok: true });
      expect(response.test.script).not.toBe(original);
      expect(countAssertions(response.test.script)).toBe(countAssertions(original));
    }
  });

  it('reporta el bug de ordenación del ejemplo de problem_user', async () => {
    const response = await repair(requestFor(demoTest('sort-by-price').script), logger);
    expect(response).toMatchObject({ status: 'bug_report', diagnosis: { category: 'app_bug' } });
  });

  it.each([
    ['otro ejemplo', demoTest('invalid-login').script],
    ['un script cualquiera', 'x'],
  ])('responde demo_mode con %s', async (_name, script) => {
    await expect(repair(requestFor(script), logger)).rejects.toMatchObject({
      statusCode: 503,
      code: 'demo_mode',
    });
  });
});
