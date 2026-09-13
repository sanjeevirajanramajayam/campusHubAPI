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
  (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body') =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (source === 'query') {
        const parsed = (await schema.parseAsync(req.query)) as Record<string, unknown>;
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else if (source === 'params') {
        const parsed = (await schema.parseAsync(req.params)) as Record<string, unknown>;
        Object.defineProperty(req, 'params', {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else {
        req.body = await schema.parseAsync(req.body);
      }
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
