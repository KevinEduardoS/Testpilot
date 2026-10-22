import { readFileSync } from 'node:fs';

export type PromptName = 'generate-test.system' | 'repair-test.system';

// Ruta relativa a este módulo: src/prompts en desarrollo y dist/prompts en el bundle de producción.
export const loadPrompt = (name: PromptName): string => {
  const prompt = readFileSync(new URL(`./prompts/${name}.md`, import.meta.url), 'utf8').trim();
  if (prompt.length === 0) {
    throw new Error(`El prompt "${name}" está vacío`);
  }
  return prompt;
};
