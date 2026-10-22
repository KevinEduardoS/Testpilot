import Anthropic from '@anthropic-ai/sdk';
import { buildApp } from './app.js';
import { env } from './config.js';
import { loadPrompt } from './prompt-loader.js';
import { createTestGenerator } from './test-generator.js';

const client = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  maxRetries: env.AI_MAX_RETRIES,
  timeout: env.AI_TIMEOUT_MS,
});

const app = await buildApp({
  webOrigin: env.WEB_ORIGIN,
  runnerUrl: env.RUNNER_URL,
  internalApiKey: env.INTERNAL_API_KEY,
  rateLimitPerHour: env.RATE_LIMIT_PER_HOUR,
  generateTest: createTestGenerator({
    client,
    systemPrompt: loadPrompt('generate-test.system'),
    model: env.ANTHROPIC_MODEL,
    effort: env.AI_EFFORT,
    maxTokens: env.AI_MAX_TOKENS,
  }),
});

try {
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
