// Guion de la demo animada de la portada: se escribe la instrucción, aparece el script, los
// pasos se ejecutan y la IA muestra su diagnóstico. Es una ilustración, no una ejecución real.

export type HeroOutcome = {
  tone: 'passed' | 'fixed' | 'bug';
  title: string;
  detail: string;
};

export type HeroScenario = {
  instruction: string;
  code: string[];
  // El paso que falla, si alguno; los anteriores pasan y los siguientes no llegan a ejecutarse.
  steps: string[];
  failingStep: number | null;
  outcome: HeroOutcome;
};

export type HeroStepStatus = 'pending' | 'running' | 'passed' | 'failed';

export type HeroFrame = {
  typed: string;
  codeLines: number;
  steps: HeroStepStatus[];
  showOutcome: boolean;
};

const TYPE_MS = 32;
const AFTER_TYPING_MS = 350;
const CODE_LINE_MS = 120;
const STEP_MS = 650;
const OUTCOME_HOLD_MS = 3200;

const phases = (scenario: HeroScenario) => {
  const typingEnd = scenario.instruction.length * TYPE_MS;
  const codeStart = typingEnd + AFTER_TYPING_MS;
  const stepsStart = codeStart + scenario.code.length * CODE_LINE_MS;
  const executed = scenario.failingStep === null ? scenario.steps.length : scenario.failingStep + 1;
  const outcomeStart = stepsStart + executed * STEP_MS;
  return { codeStart, stepsStart, outcomeStart, end: outcomeStart + OUTCOME_HOLD_MS };
};

export const scenarioDuration = (scenario: HeroScenario): number => phases(scenario).end;

export const frameAt = (scenario: HeroScenario, elapsedMs: number): HeroFrame => {
  const { codeStart, stepsStart, outcomeStart } = phases(scenario);
  const t = Math.max(0, elapsedMs);

  const steps = scenario.steps.map((_, index): HeroStepStatus => {
    const begin = stepsStart + index * STEP_MS;
    if (scenario.failingStep !== null && index > scenario.failingStep) {
      return 'pending';
    }
    if (t < begin) {
      return 'pending';
    }
    if (t < begin + STEP_MS) {
      return 'running';
    }
    return index === scenario.failingStep ? 'failed' : 'passed';
  });

  return {
    typed: scenario.instruction.slice(0, Math.floor(t / TYPE_MS)),
    codeLines: Math.min(
      scenario.code.length,
      Math.max(0, Math.floor((t - codeStart) / CODE_LINE_MS) + 1),
    ),
    steps,
    showOutcome: t >= outcomeStart,
  };
};

export const finalFrame = (scenario: HeroScenario): HeroFrame =>
  frameAt(scenario, scenarioDuration(scenario));

export const HERO_SCENARIOS: HeroScenario[] = [
  {
    instruction:
      'Inicia sesión con problem_user, ordena por precio y verifica que el primero cueste $7.99',
    code: [
      "await page.getByPlaceholder('Username').fill('problem_user');",
      "await page.getByRole('button', { name: 'Login' }).click();",
      "await sort.selectOption('Price (low to high)');",
      "await expect(firstPrice).toHaveText('$7.99');",
    ],
    steps: ['Iniciar sesión', 'Ordenar por precio', 'Verificar el primer precio'],
    failingStep: 2,
    outcome: {
      tone: 'bug',
      title: 'Bug de la aplicación',
      detail: 'La ordenación no tiene efecto · reporte generado',
    },
  },
  {
    instruction: 'Inicia sesión y verifica que el catálogo muestre el título Products',
    code: [
      "await page.getByPlaceholder('Username').fill('standard_user');",
      "await page.getByRole('button', { name: 'Login' }).click();",
      'await expect(page).toHaveURL(/inventory/);',
      "await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();",
    ],
    steps: ['Iniciar sesión', 'Verificar el título'],
    failingStep: 1,
    outcome: {
      tone: 'fixed',
      title: 'Selector corregido',
      detail: 'El título no es un heading · v2 pasa',
    },
  },
  {
    instruction: 'Añade la mochila al carrito y verifica que el contador muestre 1',
    code: [
      "await page.getByPlaceholder('Username').fill('standard_user');",
      "await page.getByRole('button', { name: 'Login' }).click();",
      'await page.locator(\'[data-test="add-to-cart-sauce-labs-backpack"]\').click();',
      "await expect(cartBadge).toHaveText('1');",
    ],
    steps: ['Iniciar sesión', 'Añadir la mochila', 'Verificar el contador'],
    failingStep: null,
    outcome: { tone: 'passed', title: 'La prueba pasó', detail: '3 pasos en un navegador real' },
  },
];
