import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { logger } from '../common/logger.js';
import { env } from '../config/env.js';

/**
 * Global Error Handling Middleware
 *
 * WHY:
 * 1. Guarantees all API errors return a standard JSON envelope:
 *    { "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
 * 2. Prevents sensitive stack traces, DB credentials, or server internals from leaking in production.
 * 3. Logs programmer bugs (500 Internal Server Errors) with full stack trace for observability.
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // If it is our trusted operational AppError
  if (err instanceof AppError) {
    logger.warn({
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });
    return;
  }

  // Unexpected programmer bugs / unhandled exceptions (500)
  logger.error(err, 'Unhandled Application Error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error occurred' : err.message,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};
