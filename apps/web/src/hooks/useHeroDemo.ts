import { useEffect, useState } from 'react';
import {
  finalFrame,
  frameAt,
  HERO_SCENARIOS,
  scenarioDuration,
  type HeroFrame,
  type HeroScenario,
} from '../hero-timeline';

const TICK_MS = 50;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reproduce en bucle los escenarios de la portada. Con "reducir movimiento" muestra el estado
// final del primero, sin animar.
export const useHeroDemo = (): { scenario: HeroScenario; frame: HeroFrame } => {
  const [state, setState] = useState(() => {
    const scenario = HERO_SCENARIOS[0] as HeroScenario;
    return {
      index: 0,
      frame: prefersReducedMotion() ? finalFrame(scenario) : frameAt(scenario, 0),
    };
  });

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }
    let index = 0;
    let startedAt = performance.now();
    const timer = window.setInterval(() => {
      let scenario = HERO_SCENARIOS[index] as HeroScenario;
      let elapsed = performance.now() - startedAt;
      if (elapsed >= scenarioDuration(scenario)) {
        index = (index + 1) % HERO_SCENARIOS.length;
        scenario = HERO_SCENARIOS[index] as HeroScenario;
        startedAt = performance.now();
        elapsed = 0;
      }
      setState({ index, frame: frameAt(scenario, elapsed) });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return { scenario: HERO_SCENARIOS[state.index] as HeroScenario, frame: state.frame };
};
