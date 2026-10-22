import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanErrorMessage,
  createExecutor,
  ExecutionError,
  type ExecutionProgress,
  type Executor,
} from './executor.js';

// Lanzan un navegador real: dan margen al arranque de Chromium.
const BROWSER_TEST_TIMEOUT_MS = 60_000;

const page = (html: string, steps: string) => `import { test, expect } from '@playwright/test';

test('caso', async ({ page }) => {
  await test.step('cargar la página', async () => {
    await page.setContent(${JSON.stringify(html)});
  });
${steps}
});
`;

let runsDir: string;
let executor: Executor;
const execute = (script: string) => executor.run(script);

beforeAll(async () => {
  // Dentro del paquete para que los scripts resuelvan @playwright/test, igual que en producción.
  const packageDir = fileURLToPath(new URL('..', import.meta.url));
  runsDir = await mkdtemp(join(packageDir, '.runs-test-'));
  executor = createExecutor({ runsDir, timeoutMs: 10_000 });
});

afterAll(async () => {
  await rm(runsDir, { recursive: true, force: true });
});

describe('createExecutor', () => {
  it(
    'ejecuta una prueba que pasa y devuelve pasos y captura',
    async () => {
      const result = await execute(
        page(
          '<button>Enviar</button>',
          `  await test.step('verificar el botón', async () => {
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible();
  });`,
        ),
      );

      expect(result.status).toBe('passed');
      expect(result.error).toBeNull();
      expect(result.steps.map(({ title, status }) => ({ title, status }))).toEqual([
        { title: 'cargar la página', status: 'passed' },
        { title: 'verificar el botón', status: 'passed' },
      ]);
      expect(result.screenshot).toMatch(/^data:image\/png;base64,/);
      expect(await readdir(runsDir)).toEqual([]);
    },
    BROWSER_TEST_TIMEOUT_MS,
  );

  it(
    'reporta el paso que falla con un mensaje limpio',
    async () => {
      const result = await execute(
        page(
          '<button>Enviar</button>',
          `  await test.step('buscar un botón inexistente', async () => {
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible({ timeout: 500 });
  });
  await test.step('nunca se ejecuta', async () => {});`,
        ),
      );

      expect(result.status).toBe('failed');
      expect(result.steps.map((step) => step.status)).toEqual(['passed', 'failed']);
      expect(result.steps[1]?.error).toContain('toBeVisible');
      expect(result.error).not.toContain('\u001b');
      expect(result.error).not.toContain('Call log');
      expect(result.screenshot).not.toBeNull();
    },
    BROWSER_TEST_TIMEOUT_MS,
  );

  it(
    'no expone las variables de entorno del runner al script',
    async () => {
      process.env.INTERNAL_API_KEY = 'secreto-que-no-debe-filtrarse';
      try {
        // El runner rechaza este script por política; aquí se llama al ejecutor directamente
        // para comprobar que, aun así, el proceso hijo no recibe el secreto.
        const result = await execute(
          page(
            '<p>x</p>',
            `  await test.step('leer el entorno', async () => {
    expect(process.env.INTERNAL_API_KEY).toBeUndefined();
  });`,
          ),
        );
        expect(result.status).toBe('passed');
      } finally {
        delete process.env.INTERNAL_API_KEY;
      }
    },
    BROWSER_TEST_TIMEOUT_MS,
  );

  it(
    'devuelve un fallo cuando el script no compila',
    async () => {
      const result = await execute(`import { test } from '@playwright/test';\ntest('x', async ( => {});`);
      expect(result.status).toBe('failed');
      expect(result.steps).toEqual([]);
      expect(result.error).toBeTruthy();
    },
    BROWSER_TEST_TIMEOUT_MS,
  );

  it(
    'emite el progreso de cada paso mientras se ejecuta',
    async () => {
      const events: ExecutionProgress[] = [];
      await executor.run(
        page(
          '<button>Enviar</button>',
          `  await test.step('verificar el botón', async () => {
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible();
  });`,
        ),
        { onProgress: (event) => events.push(event) },
      );

      expect(events.map((event) => [event.type, event.index])).toEqual([
        ['step-begin', 0],
        ['step-end', 0],
        ['step-begin', 1],
        ['step-end', 1],
      ]);
      expect(events[3]).toMatchObject({
        type: 'step-end',
        step: { title: 'verificar el botón', status: 'passed', error: null },
      });
    },
    BROWSER_TEST_TIMEOUT_MS,
  );

  it(
    'ignora en el progreso lo que el script imprime por consola',
    async () => {
      const events: ExecutionProgress[] = [];
      await executor.run(
        page(
          '<p>x</p>',
          `  await test.step('imprimir', async () => {
    console.log(JSON.stringify({ type: 'step-begin', index: 99, title: 'falso' }));
  });`,
        ),
        { onProgress: (event) => events.push(event) },
      );
      expect(events.some((event) => event.index === 99)).toBe(false);
    },
    BROWSER_TEST_TIMEOUT_MS,
  );

  it(
    'cancela la ejecución al abortar',
    async () => {
      const abort = new AbortController();
      const run = executor.run(
        page(
          '<p>x</p>',
          `  await test.step('esperar indefinidamente', async () => {
    await expect(page.getByText('nunca aparece')).toBeVisible({ timeout: 60_000 });
  });`,
        ),
        {
          signal: abort.signal,
          onProgress: (event) => {
            if (event.type === 'step-begin' && event.index === 1) {
              abort.abort();
            }
          },
        },
      );
      await expect(run).rejects.toBeInstanceOf(ExecutionError);
      expect(executor.isBusy()).toBe(false);
    },
    BROWSER_TEST_TIMEOUT_MS,
  );

  it(
    'rechaza una segunda ejecución simultánea',
    async () => {
      const script = page('<p>x</p>', '');
      const [first, second] = await Promise.allSettled([execute(script), execute(script)]);
      expect(first.status).toBe('fulfilled');
      expect(second.status === 'rejected' && second.reason).toBeInstanceOf(ExecutionError);
    },
    BROWSER_TEST_TIMEOUT_MS,
  );
});

describe('cleanErrorMessage', () => {
  it('quita colores ANSI y el call log', () => {
    const raw = `Error: \u001b[31mTimed out\u001b[39m\n\nLocator: x\nCall log:\n  - waiting`;
    expect(cleanErrorMessage(raw)).toBe('Error: Timed out\n\nLocator: x');
  });

  it('devuelve null sin mensaje', () => {
    expect(cleanErrorMessage(undefined)).toBeNull();
  });
});
