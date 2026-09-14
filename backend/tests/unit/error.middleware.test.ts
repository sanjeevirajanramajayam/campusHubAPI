import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/error.middleware.js';
import { NotFoundError, ConflictError } from '../../src/common/errors/app-error.js';
import type { Request, Response, NextFunction } from 'express';

describe('Global Error Handler Middleware', () => {
  const req = {
    method: 'POST',
    originalUrl: '/api/v1/clubs',
  } as Request;

  const createMockRes = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const next = vi.fn() as NextFunction;

  it('should handle operational AppError (e.g. 404 NotFoundError) and format JSON response', () => {
    const res = createMockRes();
    const error = new NotFoundError('Club not found');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Club not found',
        details: null,
      },
    });
  });

  it('should handle operational AppError with details (e.g. 409 ConflictError)', () => {
    const res = createMockRes();
    const error = new ConflictError('User already exists', 'CONFLICT', { email: 'duplicate@test.com' });

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'User already exists',
        details: { email: 'duplicate@test.com' },
      },
    });
  });

  it('should handle unknown runtime crashes with 500 and generic message in production mode', () => {
    const res = createMockRes();
    const unknownError = new Error('Database connection socket closed abruptly');

    errorHandler(unknownError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
        }),
      }),
    );
  });
});
