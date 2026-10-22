import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { AllowedDomains, ExecutionResult, StepResult } from '@testpilot/shared';
import { z } from 'zod';

// Margen para que Playwright cierre el navegador y escriba el reporte tras el timeout del test.
const PROCESS_GRACE_MS = 15_000;
const STDERR_TAIL_CHARS = 2000;
const SNAPSHOT_ATTACHMENT = 'testpilot-page-snapshot';
const SNAPSHOT_TIMEOUT_MS = 5000;
const TRUNCATION_MARKER = '\n… (snapshot truncado)';
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

// Solo lo imprescindible para que Node y el navegador funcionen: el script generado nunca
// recibe INTERNAL_API_KEY ni ninguna otra variable del runner.
const INHERITED_ENV = [
  'PATH',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'PLAYWRIGHT_BROWSERS_PATH',
];

const playwrightCli = createRequire(import.meta.url).resolve('@playwright/test/cli');
// Relativo a este módulo: funciona igual desde src/ en desarrollo y desde dist/ en producción.
const progressReporter = fileURLToPath(
  new URL('../reporter/progress-reporter.mjs', import.meta.url),
);

const reporterEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('step-begin'), index: z.number().int().min(0), title: z.string() }),
  z.object({
    type: z.literal('step-end'),
    index: z.number().int().min(0),
    title: z.string(),
    durationMs: z.number(),
    error: z.string().nullable(),
  }),
]);

export type ExecutionProgress =
  | { type: 'step-begin'; index: number; title: string }
  | { type: 'step-end'; index: number; step: StepResult };

type ReportStep = { title: string; duration: number; error?: { message?: string } };

const reportResultSchema = z.object({
  status: z.enum(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']),
  duration: z.number(),
  error: z.object({ message: z.string().optional() }).optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        duration: z.number(),
        error: z.object({ message: z.string().optional() }).optional(),
      }),
    )
    .default([]),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        contentType: z.string(),
        path: z.string().optional(),
        body: z.string().optional(),
      }),
    )
    .default([]),
});

type ReportSuite = {
  specs?: { tests: { results: unknown[] }[] }[];
  suites?: ReportSuite[];
};

const reportSchema = z.object({
  suites: z.array(z.custom<ReportSuite>()).default([]),
  errors: z.array(z.object({ message: z.string().optional() })).default([]),
});

export class ExecutionError extends Error {
  constructor(
    readonly code: 'runner_busy' | 'execution_failed',
    message: string,
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

// Mensajes de Playwright sin colores y sin el "Call log", que solo es útil para depurar en local.
export const cleanErrorMessage = (message: string | undefined): string | null => {
  if (message === undefined) {
    return null;
  }
  const clean = message.replace(ANSI_PATTERN, '').split('\nCall log:')[0]?.trim() ?? '';
  return clean === '' ? null : clean;
};

const collectResults = (suites: ReportSuite[]): unknown[] =>
  suites.flatMap((suite) => [
    ...(suite.specs ?? []).flatMap((spec) => spec.tests.flatMap((test) => test.results)),
    ...collectResults(suite.suites ?? []),
  ]);

const toStep = (step: ReportStep): StepResult => ({
  title: step.title,
  status: step.error ? 'failed' : 'passed',
  durationMs: step.duration,
  error: cleanErrorMessage(step.error?.message),
});

// Se añade al final del script ya validado. Si la prueba no pasa, adjunta el árbol de
// accesibilidad de la página para diagnosticar el fallo; si no se puede capturar, se ignora
// para no alterar el resultado.
const SNAPSHOT_HOOK = `
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  try {
    const snapshot = await page.locator('body').ariaSnapshot({ timeout: ${SNAPSHOT_TIMEOUT_MS} });
    await testInfo.attach('${SNAPSHOT_ATTACHMENT}', { body: snapshot, contentType: 'text/plain' });
  } catch {
    // Sin snapshot: el diagnóstico se hará solo con el error.
  }
});
`;

const truncate = (text: string, maxChars: number): string =>
  text.length <= maxChars
    ? text
    : text.slice(0, maxChars - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;

// Todo el tráfico del navegador va a un proxy inexistente salvo el de los dominios permitidos,
// así que cualquier otro destino falla: otros sitios, IPs, localhost (<-loopback> quita la
// excepción que Chromium hace con él) y la IP de metadatos de la nube. Cubre también
// redirecciones, enlaces y recursos que la política estática no puede ver.
const BLACKHOLE_PROXY = 'http://127.0.0.1:9';

const networkArgs = (allowedDomains: AllowedDomains): string[] => {
  if (allowedDomains === null) {
    return [];
  }
  const bypass = allowedDomains.flatMap((domain) => [domain, `*.${domain}`]);
  return [
    `--proxy-server=${BLACKHOLE_PROXY}`,
    `--proxy-bypass-list=${[...bypass, '<-loopback>'].join(';')}`,
  ];
};

const buildConfig = (timeoutMs: number, allowedDomains: AllowedDomains): string =>
  `export default ${JSON.stringify(
    {
      testDir: '.',
      testMatch: 'generated.spec.ts',
      timeout: timeoutMs,
      retries: 0,
      workers: 1,
      reporter: [['json', { outputFile: 'report.json' }], [progressReporter]],
      outputDir: 'artifacts',
      use: {
        headless: true,
        screenshot: 'on',
        trace: 'off',
        video: 'off',
        launchOptions: { args: networkArgs(allowedDomains) },
      },
    },
    null,
    2,
  )};\n`;

// Las líneas mal formadas se ignoran: el progreso es informativo y el resultado final sale
// del reporte JSON.
const readProgress = (stream: Readable, onProgress: (event: ExecutionProgress) => void) => {
  createInterface({ input: stream }).on('line', (line) => {
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      return;
    }
    const parsed = reporterEventSchema.safeParse(json);
    if (!parsed.success) {
      return;
    }
    const event = parsed.data;
    onProgress(
      event.type === 'step-begin'
        ? event
        : {
            type: 'step-end',
            index: event.index,
            step: {
              title: event.title,
              status: event.error === null ? 'passed' : 'failed',
              durationMs: event.durationMs,
              error: cleanErrorMessage(event.error ?? undefined),
            },
          },
    );
  });
};

// Playwright lanza el navegador como proceso hijo: matar solo a Playwright dejaría Chromium
// huérfano, con los archivos del directorio de la ejecución bloqueados.
const killProcessTree = (child: ChildProcess) => {
  if (child.pid === undefined || child.exitCode !== null) {
    return;
  }
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    // Con detached el hijo encabeza su propio grupo; un pid negativo mata a todo el grupo.
    process.kill(-child.pid, 'SIGKILL');
  }
};

type RunOptions = {
  cwd: string;
  killAfterMs: number;
  onProgress: (event: ExecutionProgress) => void;
  signal?: AbortSignal;
};

const runPlaywright = ({ cwd, killAfterMs, onProgress, signal }: RunOptions): Promise<string> =>
  new Promise((resolve, reject) => {
    const env = Object.fromEntries(
      INHERITED_ENV.flatMap((name) => {
        const value = process.env[name];
        return value === undefined ? [] : [[name, value]];
      }),
    );
    const child = spawn(
      process.execPath,
      [playwrightCli, 'test', '--config', 'playwright.config.mjs'],
      {
        cwd,
        env,
        detached: process.platform !== 'win32',
        // El descriptor 3 es el canal exclusivo del reporter de progreso.
        stdio: ['ignore', 'ignore', 'pipe', 'pipe'],
      },
    );

    const progressStream = child.stdio[3];
    if (progressStream && 'on' in progressStream) {
      readProgress(progressStream as Readable, onProgress);
    }

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL_CHARS);
    });

    const kill = () => killProcessTree(child);
    const timer = setTimeout(kill, killAfterMs);
    signal?.addEventListener('abort', kill, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', kill);
    };

    child.on('error', (error) => {
      cleanup();
      reject(error);
    });
    // Playwright sale con código 1 cuando una prueba falla; el resultado se lee del reporte.
    child.on('close', () => {
      cleanup();
      resolve(stderr);
    });
  });

const readScreenshot = async (path: string | undefined): Promise<string | null> => {
  if (path === undefined) {
    return null;
  }
  const data = await readFile(path);
  return `data:image/png;base64,${data.toString('base64')}`;
};

export type ExecutorOptions = {
  runsDir: string;
  timeoutMs: number;
  snapshotMaxChars: number;
  allowedDomains: AllowedDomains;
};

export type RunScriptOptions = {
  onProgress?: (event: ExecutionProgress) => void;
  // Al abortar se mata el proceso de Playwright, por ejemplo si el cliente se desconecta.
  signal?: AbortSignal;
};

export type Executor = {
  isBusy: () => boolean;
  run: (script: string, options?: RunScriptOptions) => Promise<ExecutionResult>;
};

export const createExecutor = ({
  runsDir,
  timeoutMs,
  snapshotMaxChars,
  allowedDomains,
}: ExecutorOptions): Executor => {
  let running = false;

  const run = async (
    script: string,
    { onProgress, signal }: RunScriptOptions = {},
  ): Promise<ExecutionResult> => {
    // Una ejecución a la vez: cada una lanza un navegador completo.
    if (running) {
      throw new ExecutionError('runner_busy', 'El runner está ejecutando otra prueba.');
    }
    running = true;
    const runDir = join(runsDir, randomUUID());

    try {
      await mkdir(runDir, { recursive: true });
      await writeFile(join(runDir, 'generated.spec.ts'), `${script}\n${SNAPSHOT_HOOK}`);
      await writeFile(
        join(runDir, 'playwright.config.mjs'),
        buildConfig(timeoutMs, allowedDomains),
      );

      const stderr = await runPlaywright({
        cwd: runDir,
        killAfterMs: timeoutMs + PROCESS_GRACE_MS,
        onProgress: onProgress ?? (() => undefined),
        signal,
      });

      let rawReport: string;
      try {
        rawReport = await readFile(join(runDir, 'report.json'), 'utf8');
      } catch {
        throw new ExecutionError(
          'execution_failed',
          `Playwright no generó un reporte. ${cleanErrorMessage(stderr) ?? ''}`.trim(),
        );
      }

      const report = reportSchema.parse(JSON.parse(rawReport));
      const [rawResult] = collectResults(report.suites);

      if (rawResult === undefined) {
        // Sin resultados: el archivo no compiló o no definió ningún test.
        return {
          status: 'failed',
          durationMs: 0,
          steps: [],
          error:
            cleanErrorMessage(report.errors.map((error) => error.message ?? '').join('\n')) ??
            'El script no definió ninguna prueba.',
          screenshot: null,
          pageSnapshot: null,
        };
      }

      const result = reportResultSchema.parse(rawResult);
      const screenshot = result.attachments.find(
        (attachment) => attachment.name === 'screenshot' && attachment.contentType === 'image/png',
      );
      // El último: el hook corre después del cuerpo de la prueba, que podría adjuntar uno falso.
      const snapshot = result.attachments
        .filter((attachment) => attachment.name === SNAPSHOT_ATTACHMENT)
        .at(-1)?.body;

      return {
        status: result.status === 'skipped' ? 'interrupted' : result.status,
        durationMs: result.duration,
        steps: result.steps.map(toStep),
        error: cleanErrorMessage(result.error?.message),
        screenshot: await readScreenshot(screenshot?.path),
        pageSnapshot:
          snapshot === undefined
            ? null
            : truncate(Buffer.from(snapshot, 'base64').toString('utf8'), snapshotMaxChars),
      };
    } finally {
      try {
        // Windows puede tardar en liberar los archivos tras matar el navegador.
        await rm(runDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // Un directorio que no se pudo borrar no debe ocultar el resultado ni bloquear el runner;
        // queda en .runs, que está fuera del control de versiones.
      } finally {
        running = false;
      }
    }
  };

  return { isBusy: () => running, run };
};
