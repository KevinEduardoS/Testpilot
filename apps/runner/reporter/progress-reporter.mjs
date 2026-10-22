import { writeSync } from 'node:fs';

// Reporter de Playwright que emite el progreso de cada test.step() de primer nivel como líneas
// JSON por el descriptor 3, un canal que el runner abre solo para esto. El script generado
// escribe en stdout/stderr, así que no puede falsear estos eventos.
const PROGRESS_FD = 3;

const emit = (event) => {
  writeSync(PROGRESS_FD, `${JSON.stringify(event)}\n`);
};

const isTopLevelStep = (step) => step.category === 'test.step' && step.parent === undefined;

export default class ProgressReporter {
  #indexes = new Map();
  #nextIndex = 0;

  printsToStdio() {
    return false;
  }

  onStepBegin(_test, _result, step) {
    if (!isTopLevelStep(step)) {
      return;
    }
    const index = this.#nextIndex++;
    this.#indexes.set(step, index);
    emit({ type: 'step-begin', index, title: step.title });
  }

  onStepEnd(_test, _result, step) {
    const index = this.#indexes.get(step);
    if (index === undefined) {
      return;
    }
    emit({
      type: 'step-end',
      index,
      title: step.title,
      durationMs: step.duration,
      error: step.error?.message ?? null,
    });
  }
}
