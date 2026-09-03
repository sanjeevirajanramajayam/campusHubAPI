/**
 * Base Application Error
 * 
 * WHY:
 * Extends the native `Error` class and adds standard properties:
 * - `statusCode`: HTTP status code (e.g. 400, 401, 403, 404, 500)
 * - `code`: Unique machine-readable error code string (e.g. 'VALIDATION_ERROR', 'USER_NOT_FOUND')
 * - `isOperational`: Differentiates operational errors (expected client errors) from programmer bugs (unhandled crashes).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    // Captures the call stack, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details?: unknown) {
    super(message, 401, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', details?: unknown) {
    super(message, 403, code, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found', code = 'NOT_FOUND', details?: unknown) {
    super(message, 404, code, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource Conflict', code = 'CONFLICT', details?: unknown) {
    super(message, 409, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable Entity', code = 'UNPROCESSABLE_ENTITY', details?: unknown) {
    super(message, 422, code, details);
  }
}

