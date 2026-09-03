import type { Request, Response, NextFunction } from 'express';
import { type ZodTypeAny, ZodError } from 'zod';
import { ValidationError } from '../common/errors/app-error.js';

/**
 * Reusable Zod Validation Middleware
 *
 * WHY:
 * 1. Guarantees controllers receive clean, verified, and typed payloads.
 * 2. Catches malformed user input at the HTTP boundary before it reaches domain services.
 * 3. Formats multiple Zod validation issues into a consistent, readable error response.
 */
export const validate =
  (schema: ZodTypeAny) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        next(new ValidationError('Request validation failed', details));
        return;
      }
      next(err);
    }
  };
