import { z } from 'zod';

export const healthStatusSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const runnerPingSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export type RunnerPing = z.infer<typeof runnerPingSchema>;

export const MAX_INSTRUCTION_LENGTH = 1000;
export const MAX_SCRIPT_LENGTH = 20_000;
export const MAX_PREVIOUS_INSTRUCTIONS = 10;

// Conversación previa para refinar una prueba: el modelo recibe el script vigente y las
// instrucciones anteriores, y devuelve una versión nueva del script.
export const conversationContextSchema = z.object({
  previousInstructions: z
    .array(z.string().max(MAX_INSTRUCTION_LENGTH))
    .min(1)
    .max(MAX_PREVIOUS_INSTRUCTIONS),
  currentScript: z.string().min(1).max(MAX_SCRIPT_LENGTH),
});

export type ConversationContext = z.infer<typeof conversationContextSchema>;

export const generateTestRequestSchema = z.object({
  instruction: z.string().trim().min(1).max(MAX_INSTRUCTION_LENGTH),
  baseUrl: z.url({ protocol: /^https?$/ }).optional(),
  context: conversationContextSchema.optional(),
});

export type GenerateTestRequest = z.infer<typeof generateTestRequestSchema>;

export const generatedTestSchema = z.object({
  title: z.string(),
  steps: z.array(z.string()),
  script: z.string(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type GeneratedTest = z.infer<typeof generatedTestSchema>;

export const generateTestResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), test: generatedTestSchema }),
  z.object({ status: z.literal('needs_clarification'), question: z.string() }),
  z.object({ status: z.literal('rejected'), reason: z.string() }),
]);

export type GenerateTestResponse = z.infer<typeof generateTestResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.string()).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const executeTestRequestSchema = z.object({
  script: z.string().min(1).max(MAX_SCRIPT_LENGTH),
});

export type ExecuteTestRequest = z.infer<typeof executeTestRequestSchema>;

export const stepResultSchema = z.object({
  title: z.string(),
  status: z.enum(['passed', 'failed']),
  durationMs: z.number(),
  error: z.string().nullable(),
});

export type StepResult = z.infer<typeof stepResultSchema>;

export const executionResultSchema = z.object({
  status: z.enum(['passed', 'failed', 'timedOut', 'interrupted']),
  durationMs: z.number(),
  steps: z.array(stepResultSchema),
  error: z.string().nullable(),
  // Captura PNG del estado final de la página como data URL.
  screenshot: z.string().nullable(),
});

export type ExecutionResult = z.infer<typeof executionResultSchema>;

// Eventos de una ejecución en streaming (NDJSON). Termina siempre con "result" o "error".
export const executionEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('step-begin'), index: z.number().int().min(0), title: z.string() }),
  z.object({ type: z.literal('step-end'), index: z.number().int().min(0), step: stepResultSchema }),
  z.object({ type: z.literal('result'), result: executionResultSchema }),
  z.object({ type: z.literal('error'), error: apiErrorSchema }),
]);

export type ExecutionEvent = z.infer<typeof executionEventSchema>;

export const aiProviderSchema = z.enum(['anthropic', 'demo']);

export type AiProvider = z.infer<typeof aiProviderSchema>;

export const appInfoSchema = z.object({ aiProvider: aiProviderSchema });

export type AppInfo = z.infer<typeof appInfoSchema>;

// Ejemplos de la web. En modo demo son las únicas instrucciones que la API sabe responder.
export const EXAMPLES = [
  {
    id: 'invalid-login',
    label: 'Login con credenciales inválidas',
    instruction:
      'Inicia sesión con un usuario inválido y verifica que aparezca el mensaje de error.',
    baseUrl: 'https://www.saucedemo.com',
  },
  {
    id: 'add-to-cart',
    label: 'Añadir producto al carrito',
    instruction:
      'Inicia sesión con el usuario de demostración, añade la mochila al carrito y verifica que el contador del carrito muestre 1.',
    baseUrl: 'https://www.saucedemo.com',
  },
  {
    id: 'empty-form',
    label: 'Validación de formulario',
    instruction:
      'Abre el formulario de login, envíalo vacío y verifica que se muestre el error de usuario requerido.',
    baseUrl: 'https://www.saucedemo.com',
  },
] as const;

export type ExampleId = (typeof EXAMPLES)[number]['id'];
