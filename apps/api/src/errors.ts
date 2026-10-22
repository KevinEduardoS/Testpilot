// Error con código HTTP y código estable para el cliente; el manejador global de la app lo serializa
// con la forma de apiErrorSchema.
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
