import { describe, it, expect, vi } from 'vitest';
import { validate } from '../../src/middleware/validate.middleware.js';
import { z } from 'zod';
import { ValidationError } from '../../src/common/errors/app-error.js';
import type { Request, Response, NextFunction } from 'express';

describe('Validate Middleware', () => {
  const schema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
  });

  it('should call next() and assign parsed data to req.body when payload is valid', async () => {
    const middleware = validate(schema);

    const req = {
      body: {
        name: 'Alex Chen',
        email: 'alex@stanford.edu',
      },
    } as Request;

    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // No error passed
    expect(req.body).toEqual({
      name: 'Alex Chen',
      email: 'alex@stanford.edu',
    });
  });

  it('should pass ValidationError to next() when payload fails schema constraints', async () => {
    const middleware = validate(schema);

    const req = {
      body: {
        name: 'Al', // Too short (< 3)
        email: 'not-an-email',
      },
    } as Request;

    const res = {} as Response;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = next.mock.calls[0][0];

    expect(errorArg).toBeInstanceOf(ValidationError);
    const validationError = errorArg as ValidationError;
    expect(validationError.statusCode).toBe(422);
    expect(Array.isArray(validationError.details)).toBe(true);
    expect((validationError.details as any[]).length).toBe(2);
  });
});
