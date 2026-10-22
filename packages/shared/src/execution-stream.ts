import { executionEventSchema, type ExecutionEvent } from './index.js';

const streamError = (error: string, message: string): ExecutionEvent => ({
  type: 'error',
  error: { error, message },
});

// Lee un stream NDJSON de eventos de ejecución. Nunca lanza: un evento inválido, un corte de
// conexión o un stream que acaba sin resultado se convierten en un evento "error", así que el
// consumidor siempre recibe como último evento "result" o "error".
// Usa getReader() en lugar de for-await porque Safari no itera ReadableStream.
export async function* readExecutionEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ExecutionEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try {
        chunk = await reader.read();
      } catch {
        yield streamError('stream_interrupted', 'Se perdió la conexión durante la ejecución.');
        return;
      }
      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim() === '') {
          continue;
        }
        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch {
          yield streamError('invalid_event', 'Se recibió un evento de ejecución inválido.');
          return;
        }
        const event = executionEventSchema.safeParse(json);
        if (!event.success) {
          yield streamError('invalid_event', 'Se recibió un evento de ejecución inválido.');
          return;
        }
        yield event.data;
        if (event.data.type === 'result' || event.data.type === 'error') {
          return;
        }
      }
    }
    yield streamError('stream_incomplete', 'La ejecución terminó sin un resultado.');
  } finally {
    // Libera la conexión si el consumidor deja de leer antes del final.
    await reader.cancel().catch(() => undefined);
  }
}
