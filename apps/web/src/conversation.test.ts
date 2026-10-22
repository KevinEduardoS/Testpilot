import { MAX_PREVIOUS_INSTRUCTIONS, type GeneratedTest } from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  buildContext,
  instructionsForVersion,
  nextVersionNumber,
  versionsOf,
  type Turn,
} from './conversation';

const test = (script: string): GeneratedTest => ({
  title: script,
  steps: [],
  script,
  assumptions: [],
  warnings: [],
});

const okTurn = (id: number, version: number, script: string): Turn => ({
  id,
  kind: 'instruction',
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
    kind: 'instruction',
    instruction: 'instrucción 2',
    reply: {
      phase: 'done',
      result: { ok: true, data: { status: 'needs_clarification', question: '¿Qué sitio?' } },
      version: null,
    },
  },
  okTurn(3, 2, 'script v2'),
  {
    id: 4,
    kind: 'instruction',
    instruction: 'instrucción 4',
    reply: { phase: 'loading', startedAt: 0 },
  },
];

describe('versionsOf', () => {
  it('devuelve solo las respuestas que generaron una prueba', () => {
    expect(versionsOf(turns).map((version) => [version.number, version.test.script])).toEqual([
      [1, 'script v1'],
      [2, 'script v2'],
    ]);
  });
});

const repairTurn = (id: number, sourceVersion: number, version: number): Turn => ({
  id,
  kind: 'repair',
  sourceVersion,
  reply: {
    phase: 'done',
    result: {
      ok: true,
      data: {
        status: 'fixed',
        diagnosis: { category: 'selector', summary: 'selector' },
        test: test(`reparación de v${sourceVersion}`),
      },
    },
    version,
  },
});

describe('versiones reparadas', () => {
  const withRepair: Turn[] = [okTurn(1, 1, 'script v1'), repairTurn(2, 1, 2), okTurn(3, 3, 'v3')];

  it('cuentan como versiones e indican de cuál son reparación', () => {
    expect(
      versionsOf(withRepair).map(({ number, repairedFrom }) => [number, repairedFrom]),
    ).toEqual([
      [1, null],
      [2, 1],
      [3, null],
    ]);
  });

  it('no aportan instrucciones al contexto', () => {
    expect(buildContext(withRepair, versionsOf(withRepair)[1])?.previousInstructions).toEqual([
      'instrucción 1',
      'instrucción 3',
    ]);
  });

  it('heredan las instrucciones previas a la reparación', () => {
    expect(instructionsForVersion(withRepair, 2)).toEqual(['instrucción 1']);
    expect(instructionsForVersion(withRepair, 3)).toEqual(['instrucción 1', 'instrucción 3']);
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
