import { describe, expect, it } from 'vitest';
import {
  finalFrame,
  frameAt,
  HERO_SCENARIOS,
  scenarioDuration,
  type HeroScenario,
} from './hero-timeline';

const scenario: HeroScenario = {
  instruction: 'abc',
  code: ['l1', 'l2'],
  steps: ['uno', 'dos', 'tres'],
  failingStep: 1,
  outcome: { tone: 'bug', title: 't', detail: 'd' },
};

describe('frameAt', () => {
  it('empieza sin texto, código ni pasos', () => {
    expect(frameAt(scenario, 0)).toEqual({
      typed: '',
      codeLines: 0,
      steps: ['pending', 'pending', 'pending'],
      showOutcome: false,
    });
  });

  it('escribe la instrucción progresivamente', () => {
    expect(frameAt(scenario, 70).typed).toBe('ab');
  });

  it('ejecuta los pasos en orden y se detiene en el que falla', () => {
    const frames = Array.from({ length: 200 }, (_, index) => frameAt(scenario, index * 50));
    const runningSecond = frames.find((frame) => frame.steps[1] === 'running');
    expect(runningSecond?.steps).toEqual(['passed', 'running', 'pending']);

    expect(finalFrame(scenario)).toEqual({
      typed: 'abc',
      codeLines: 2,
      steps: ['passed', 'failed', 'pending'],
      showOutcome: true,
    });
  });

  it('muestra el resultado solo al terminar los pasos', () => {
    expect(frameAt(scenario, scenarioDuration(scenario) - 3300).showOutcome).toBe(false);
  });
});

describe('HERO_SCENARIOS', () => {
  it.each(HERO_SCENARIOS.map((item) => [item.outcome.title, item]))(
    '%s es coherente: falla si y solo si el resultado no es un pase',
    (_title, item) => {
      expect(item.failingStep === null).toBe(item.outcome.tone === 'passed');
      expect(finalFrame(item).steps.includes('failed')).toBe(item.failingStep !== null);
    },
  );
});
