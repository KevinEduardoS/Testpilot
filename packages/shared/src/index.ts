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
export const MAX_PAGE_SNAPSHOT_LENGTH = 40_000;

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
  // Árbol de accesibilidad (ARIA snapshot) de la página cuando la prueba no pasa. Es contenido
  // de la página, así que la IA lo recibe como datos.
  pageSnapshot: z.string().max(MAX_PAGE_SNAPSHOT_LENGTH).nullable(),
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

// Reparación: el cliente envía el script que falló y la evidencia de la ejecución. Todo es
// contenido no confiable que la IA recibe como datos.
export const MAX_ERROR_LENGTH = 10_000;
export const MAX_STEP_TITLE_LENGTH = 500;
export const MAX_STEPS = 50;

export const executionFailureSchema = z.object({
  status: z.enum(['failed', 'timedOut', 'interrupted']),
  error: z.string().max(MAX_ERROR_LENGTH).nullable(),
  steps: z
    .array(
      stepResultSchema.extend({
        title: z.string().max(MAX_STEP_TITLE_LENGTH),
        error: z.string().max(MAX_ERROR_LENGTH).nullable(),
      }),
    )
    .max(MAX_STEPS),
  pageSnapshot: z.string().max(MAX_PAGE_SNAPSHOT_LENGTH).nullable(),
});

export type ExecutionFailure = z.infer<typeof executionFailureSchema>;

export const repairTestRequestSchema = z.object({
  // Lo que pidió el usuario en la conversación: define la intención que la reparación respeta.
  instructions: z
    .array(z.string().max(MAX_INSTRUCTION_LENGTH))
    .min(1)
    .max(MAX_PREVIOUS_INSTRUCTIONS),
  script: z.string().min(1).max(MAX_SCRIPT_LENGTH),
  failure: executionFailureSchema,
});

export type RepairTestRequest = z.infer<typeof repairTestRequestSchema>;

// selector, timing y assertion son fallos de la prueba; app_bug y environment, del sitio o
// del entorno, y nunca se "reparan" cambiando la prueba.
export const diagnosisCategorySchema = z.enum([
  'selector',
  'timing',
  'assertion',
  'app_bug',
  'environment',
]);

export type DiagnosisCategory = z.infer<typeof diagnosisCategorySchema>;

export const diagnosisSchema = z.object({
  category: diagnosisCategorySchema,
  summary: z.string(),
});

export type Diagnosis = z.infer<typeof diagnosisSchema>;

export const bugReportSchema = z.object({
  title: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  stepsToReproduce: z.array(z.string()),
  expected: z.string(),
  actual: z.string(),
});

export type BugReport = z.infer<typeof bugReportSchema>;

export const repairTestResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('fixed'), diagnosis: diagnosisSchema, test: generatedTestSchema }),
  z.object({
    status: z.literal('bug_report'),
    diagnosis: diagnosisSchema,
    report: bugReportSchema,
  }),
  z.object({ status: z.literal('rejected'), reason: z.string() }),
]);

export type RepairTestResponse = z.infer<typeof repairTestResponseSchema>;

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
  // En modo demo, estos dos fallan a propósito para mostrar la reparación: uno por un selector
  // mal supuesto y otro por un bug real del sitio con problem_user.
  {
    id: 'catalog-title',
    label: 'Título del catálogo',
    instruction:
      'Inicia sesión con el usuario de demostración y verifica que el catálogo muestre el título Products.',
    baseUrl: 'https://www.saucedemo.com',
  },
  {
    id: 'sort-by-price',
    label: 'Ordenar por precio (problem_user)',
    instruction:
      'Inicia sesión con problem_user, ordena los productos por precio de menor a mayor y verifica que el primero cueste $7.99.',
    baseUrl: 'https://www.saucedemo.com',
  },
] as const;

export type ExampleId = (typeof EXAMPLES)[number]['id'];
