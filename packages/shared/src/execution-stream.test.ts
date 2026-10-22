import { describe, expect, it } from 'vitest';
import { readExecutionEvents } from './execution-stream.js';
import type { ExecutionEvent, ExecutionResult } from './index.js';

const passed: ExecutionResult = {
  status: 'passed',
  durationMs: 10,
  steps: [],
  error: null,
  screenshot: null,
  pageSnapshot: null,
};

// Simula la red: el texto llega troceado en fragmentos arbitrarios.
const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

const collect = async (body: ReadableStream<Uint8Array>) => {
  const events: ExecutionEvent[] = [];
  for await (const event of readExecutionEvents(body)) {
    events.push(event);
  }
  return events;
};

const line = (event: unknown) => `${JSON.stringify(event)}\n`;

describe('readExecutionEvents', () => {
  it('reconstruye eventos partidos entre fragmentos', async () => {
    const text =
      line({ type: 'step-begin', index: 0, title: 'paso' }) +
      line({ type: 'result', result: passed });
    const chunks = [text.slice(0, 7), text.slice(7, 40), text.slice(40)];
    await expect(collect(streamOf(chunks))).resolves.toEqual([
      { type: 'step-begin', index: 0, title: 'paso' },
      { type: 'result', result: passed },
    ]);
  });

  it('se detiene en el primer evento terminal', async () => {
    const text =
      line({ type: 'error', error: { error: 'x', message: 'y' } }) +
      line({ type: 'step-begin', index: 0, title: 'tarde' });
    await expect(collect(streamOf([text]))).resolves.toEqual([
      { type: 'error', error: { error: 'x', message: 'y' } },
    ]);
  });

  it.each([
    ['JSON inválido', 'no es json\n'],
    ['evento desconocido', line({ type: 'desconocido' })],
  ])('termina con un error ante %s', async (_name, text) => {
    await expect(collect(streamOf([text]))).resolves.toEqual([
      { type: 'error', error: expect.objectContaining({ error: 'invalid_event' }) },
    ]);
  });

  it('añade un error si el stream acaba sin resultado', async () => {
    const events = await collect(streamOf([line({ type: 'step-begin', index: 0, title: 'paso' })]));
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: expect.objectContaining({ error: 'stream_incomplete' }),
    });
  });

  it('convierte un corte de conexión en un error', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(line({ type: 'step-begin', index: 0, title: 'paso' })),
        );
        controller.error(new Error('conexión perdida'));
      },
    });
    const events = await collect(body);
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: expect.objectContaining({ error: 'stream_interrupted' }),
    });
  });
});
