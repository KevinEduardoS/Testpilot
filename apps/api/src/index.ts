import Anthropic from '@anthropic-ai/sdk';
import { buildApp } from './app.js';
import { env } from './config.js';
import { createDemoGenerator } from './demo-generator.js';
import { createDemoRepairer } from './demo-repairer.js';
import { loadPrompt } from './prompt-loader.js';
import { createRunnerClient } from './runner-client.js';
import { createTestGenerator } from './test-generator.js';
import { createTestRepairer } from './test-repairer.js';

const createAiServices = () => {
  if (env.AI_PROVIDER === 'demo') {
    return { generateTest: createDemoGenerator(), repairTest: createDemoRepairer() };
  }
  const settings = {
    client: new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      maxRetries: env.AI_MAX_RETRIES,
      timeout: env.AI_TIMEOUT_MS,
    }),
    model: env.ANTHROPIC_MODEL,
    effort: env.AI_EFFORT,
    maxTokens: env.AI_MAX_TOKENS,
  };
  return {
    generateTest: createTestGenerator({
      ...settings,
      systemPrompt: loadPrompt('generate-test.system'),
    }),
    repairTest: createTestRepairer({ ...settings, systemPrompt: loadPrompt('repair-test.system') }),
  };
};

const app = await buildApp({
  webOrigin: env.WEB_ORIGIN,
  runnerUrl: env.RUNNER_URL,
  internalApiKey: env.INTERNAL_API_KEY,
  rateLimitPerHour: env.RATE_LIMIT_PER_HOUR,
  aiProvider: env.AI_PROVIDER,
  ...createAiServices(),
  executeTest: createRunnerClient({
    runnerUrl: env.RUNNER_URL,
    internalApiKey: env.INTERNAL_API_KEY,
    runTimeoutMs: env.RUN_TIMEOUT_MS,
  }),
});

if (env.AI_PROVIDER === 'demo') {
  app.log.warn('Modo demo: sin IA, solo se responden los ejemplos predefinidos');
}

try {
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
