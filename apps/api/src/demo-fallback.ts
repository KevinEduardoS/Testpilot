import type { FastifyBaseLogger } from 'fastify';
import { AI_BUDGET_EXHAUSTED } from './ai-budget.js';
import { HttpError } from './errors.js';

type AiService<Request, Response> = (
  request: Request,
  logger: FastifyBaseLogger,
) => Promise<Response>;

// Con el presupuesto diario agotado, los ejemplos se siguen respondiendo con las respuestas de
// demo, así la instancia pública nunca queda sin nada que mostrar. Si la petición no es un
// ejemplo, se mantiene el error del presupuesto.
export const withDemoFallback =
  <Request, Response>(
    primary: AiService<Request, Response>,
    demo: AiService<Request, Response>,
  ): AiService<Request, Response> =>
  async (request, logger) => {
    try {
      return await primary(request, logger);
    } catch (error) {
      if (!(error instanceof HttpError && error.code === AI_BUDGET_EXHAUSTED)) {
        throw error;
      }
      try {
        return await demo(request, logger);
      } catch {
        throw error;
      }
    }
  };
