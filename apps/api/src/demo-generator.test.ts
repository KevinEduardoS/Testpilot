import { EXAMPLES } from '@testpilot/shared';
import { checkScriptPolicy } from '@testpilot/shared/script-policy';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createDemoGenerator } from './demo-generator.js';
import { HttpError } from './errors.js';

const generate = createDemoGenerator();
const logger = pino({ level: 'silent' });

describe('createDemoGenerator', () => {
  it.each(EXAMPLES.map((example) => [example.id, example.instruction]))(
    'responde al ejemplo %s con un script que cumple la política',
    async (_id, instruction) => {
      const response = await generate({ instruction }, logger);
      expect(response.status).toBe('ok');
      if (response.status === 'ok') {
        expect(checkScriptPolicy(response.test.script)).toEqual({ ok: true });
        expect(response.test.warnings).toEqual([expect.stringContaining('Modo demo')]);
      }
    },
  );

  it('ignora mayúsculas y espacios extra', async () => {
    const [first] = EXAMPLES;
    const instruction = `  ${first.instruction.toUpperCase().replace(/ /g, '   ')} `;
    await expect(generate({ instruction }, logger)).resolves.toMatchObject({ status: 'ok' });
  });

  it('rechaza instrucciones que no son ejemplos', async () => {
    const error = await generate({ instruction: 'prueba algo distinto' }, logger).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ statusCode: 503, code: 'demo_mode' });
  });
});
