import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { ExecutionResult, StepResult } from '@testpilot/shared';
import { z } from 'zod';

// Margen para que Playwright cierre el navegador y escriba el reporte tras el timeout del test.
const PROCESS_GRACE_MS = 15_000;
const STDERR_TAIL_CHARS = 2000;
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
    .array(z.object({ name: z.string(), contentType: z.string(), path: z.string().optional() }))
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

const buildConfig = (timeoutMs: number): string =>
  `export default ${JSON.stringify(
    {
      testDir: '.',
      testMatch: 'generated.spec.ts',
      timeout: timeoutMs,
      retries: 0,
      workers: 1,
      reporter: [['json', { outputFile: 'report.json' }]],
      outputDir: 'artifacts',
      use: { headless: true, screenshot: 'on', trace: 'off', video: 'off' },
    },
    null,
    2,
  )};\n`;

const runPlaywright = (cwd: string, killAfterMs: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const env = Object.fromEntries(
      INHERITED_ENV.flatMap((name) => {
        const value = process.env[name];
        return value === undefined ? [] : [[name, value]];
      }),
    );
    const child = spawn(process.execPath, [playwrightCli, 'test', '--config', 'playwright.config.mjs'], {
      cwd,
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL_CHARS);
    });

    const timer = setTimeout(() => child.kill('SIGKILL'), killAfterMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    // Playwright sale con código 1 cuando una prueba falla; el resultado se lee del reporte.
    child.on('close', () => {
      clearTimeout(timer);
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

export type ExecutorOptions = { runsDir: string; timeoutMs: number };
export type Executor = (script: string) => Promise<ExecutionResult>;

export const createExecutor = ({ runsDir, timeoutMs }: ExecutorOptions): Executor => {
  let running = false;

  return async (script) => {
    // Una ejecución a la vez: cada una lanza un navegador completo.
    if (running) {
      throw new ExecutionError('runner_busy', 'El runner está ejecutando otra prueba.');
    }
    running = true;
    const runDir = join(runsDir, randomUUID());

    try {
      await mkdir(runDir, { recursive: true });
      await writeFile(join(runDir, 'generated.spec.ts'), script);
      await writeFile(join(runDir, 'playwright.config.mjs'), buildConfig(timeoutMs));

      const stderr = await runPlaywright(runDir, timeoutMs + PROCESS_GRACE_MS);

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
        };
      }

      const result = reportResultSchema.parse(rawResult);
      const screenshot = result.attachments.find(
        (attachment) => attachment.name === 'screenshot' && attachment.contentType === 'image/png',
      );

      return {
        status: result.status === 'skipped' ? 'interrupted' : result.status,
        durationMs: result.duration,
        steps: result.steps.map(toStep),
        error: cleanErrorMessage(result.error?.message),
        screenshot: await readScreenshot(screenshot?.path),
      };
    } finally {
      await rm(runDir, { recursive: true, force: true });
      running = false;
    }
  };
};
