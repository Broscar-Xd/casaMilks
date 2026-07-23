import { Request, Response, NextFunction } from 'express';

/**
 * Middleware global de manejo de errores. Captura cualquier error
 * no manejado y retorna una respuesta estructurada.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Error]', err.message, err.stack);

  const statusCode = (err as any).statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Error interno del servidor',
  });
};

/**
 * Crea un error con código de estado HTTP para lanzar desde servicios.
 */
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
