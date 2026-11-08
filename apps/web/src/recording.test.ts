import { readFileSync } from 'node:fs';
import { EXAMPLES } from '@testpilot/shared';
import { describe, expect, it } from 'vitest';
import { normalizeInstruction, recordingSchema } from './recording';

// La grabación publicada debe seguir el contrato y cubrir cada ejemplo. Si cambia un ejemplo o
// un contrato, hay que volver a grabar: npm run record:demo --workspace apps/web.
const recording = recordingSchema.parse(
  JSON.parse(readFileSync(new URL('../public/recordings/demo.json', import.meta.url), 'utf8')),
);

describe('grabación publicada', () => {
  it.each(EXAMPLES.map((example) => [example.id, example.instruction]))(
    'el ejemplo %s tiene su generación y su ejecución',
    (_id, instruction) => {
      const generation = recording.generations.find(
        (entry) => normalizeInstruction(entry.instruction) === normalizeInstruction(instruction),
      );
      expect(generation?.response.status).toBe('ok');
      if (generation?.response.status === 'ok') {
        const { script } = generation.response.test;
        expect(recording.executions.some((execution) => execution.script === script)).toBe(true);
      }
    },
  );

  it('cada ejecución termina con un resultado y sus eventos van en orden', () => {
    for (const { events } of recording.executions) {
      expect(events.at(-1)?.event.type).toBe('result');
      const times = events.map(({ atMs }) => atMs);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  it('cada reparación corregida tiene grabada la ejecución de la versión nueva', () => {
    for (const { response } of recording.repairs) {
      if (response.status === 'fixed') {
        expect(
          recording.executions.some((execution) => execution.script === response.test.script),
        ).toBe(true);
      }
    }
  });
});
