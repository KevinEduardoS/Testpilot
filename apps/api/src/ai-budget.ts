import { HttpError } from './errors.js';

// Tope diario de tokens de IA para acotar el gasto de una instancia pública. Vive en memoria:
// se reinicia con el proceso y es aproximado, porque las llamadas en curso pueden superarlo
// un poco. El límite de gasto de la consola de Anthropic es el tope estricto.

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export type AiBudget = {
  // Lanza ai_budget_exhausted si ya se gastó el presupuesto del día.
  assertAvailable: () => void;
  record: (usage: TokenUsage) => void;
};

export const AI_BUDGET_EXHAUSTED = 'ai_budget_exhausted';

const totalTokens = (usage: TokenUsage) =>
  usage.input_tokens +
  usage.output_tokens +
  (usage.cache_creation_input_tokens ?? 0) +
  (usage.cache_read_input_tokens ?? 0);

// El día se cuenta en UTC para que el reinicio no dependa de la zona horaria del servidor.
const utcDay = (date: Date) => date.toISOString().slice(0, 10);

export const createAiBudget = ({
  dailyTokens,
  now = () => new Date(),
}: {
  dailyTokens: number;
  now?: () => Date;
}): AiBudget => {
  let day = utcDay(now());
  let used = 0;

  const rollOver = () => {
    const today = utcDay(now());
    if (today !== day) {
      day = today;
      used = 0;
    }
  };

  return {
    assertAvailable: () => {
      rollOver();
      if (used >= dailyTokens) {
        throw new HttpError(
          503,
          AI_BUDGET_EXHAUSTED,
          'La demo alcanzó su límite diario de uso de IA. Los ejemplos siguen disponibles; vuelve mañana para probar tus propias instrucciones.',
        );
      }
    },
    record: (usage) => {
      rollOver();
      used += totalTokens(usage);
    },
  };
};
