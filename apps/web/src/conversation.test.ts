import { MAX_PREVIOUS_INSTRUCTIONS, type GeneratedTest } from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import { buildContext, nextVersionNumber, versionsOf, type Turn } from './conversation';

const test = (script: string): GeneratedTest => ({
  title: script,
  steps: [],
  script,
  assumptions: [],
  warnings: [],
});

const okTurn = (id: number, version: number, script: string): Turn => ({
  id,
  instruction: `instrucción ${id}`,
  reply: {
    phase: 'done',
    result: { ok: true, data: { status: 'ok', test: test(script) } },
    version,
  },
});

const turns: Turn[] = [
  okTurn(1, 1, 'script v1'),
  {
    id: 2,
    instruction: 'instrucción 2',
    reply: {
      phase: 'done',
      result: { ok: true, data: { status: 'needs_clarification', question: '¿Qué sitio?' } },
      version: null,
    },
  },
  okTurn(3, 2, 'script v2'),
  { id: 4, instruction: 'instrucción 4', reply: { phase: 'loading', startedAt: 0 } },
];

describe('versionsOf', () => {
  it('devuelve solo las respuestas que generaron una prueba', () => {
    expect(versionsOf(turns).map((version) => [version.number, version.test.script])).toEqual([
      [1, 'script v1'],
      [2, 'script v2'],
    ]);
  });
});

describe('nextVersionNumber', () => {
  it('continúa desde la última versión', () => {
    expect(nextVersionNumber(turns)).toBe(3);
    expect(nextVersionNumber([])).toBe(1);
  });
});

describe('buildContext', () => {
  it('no envía contexto sin una versión base', () => {
    expect(buildContext(turns, undefined)).toBeUndefined();
  });

  it('usa el script de la versión base y las instrucciones previas', () => {
    const [first] = versionsOf(turns);
    expect(buildContext(turns, first)).toEqual({
      previousInstructions: ['instrucción 1', 'instrucción 2', 'instrucción 3', 'instrucción 4'],
      currentScript: 'script v1',
    });
  });

  it('limita el historial a las instrucciones más recientes', () => {
    const many = Array.from({ length: MAX_PREVIOUS_INSTRUCTIONS + 3 }, (_, index) =>
      okTurn(index + 1, index + 1, `script ${index + 1}`),
    );
    const context = buildContext(many, versionsOf(many).at(-1));
    expect(context?.previousInstructions).toHaveLength(MAX_PREVIOUS_INSTRUCTIONS);
    expect(context?.previousInstructions.at(-1)).toBe(
      `instrucción ${MAX_PREVIOUS_INSTRUCTIONS + 3}`,
    );
  });
});
