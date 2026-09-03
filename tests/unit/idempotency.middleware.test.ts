import { describe, it, expect, vi, beforeEach } from 'vitest';
import { idempotency } from '../../src/middleware/idempotency.middleware.js';
import { redis } from '../../src/infrastructure/redis/client.js';
import { ConflictError, UnprocessableEntityError } from '../../src/common/errors/app-error.js';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../src/infrastructure/redis/client.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('Idempotency Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ignore non-mutating requests (e.g. GET) and call next()', async () => {
    const middleware = idempotency();
    const req = { method: 'GET', headers: { 'idempotency-key': 'key-1' } } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('should call next() if no Idempotency-Key header is provided on POST', async () => {
    const middleware = idempotency();
    const req = { method: 'POST', headers: {} } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('should throw ConflictError (409) if the request is already currently PROCESSING', async () => {
    const middleware = idempotency();
    const req = {
      method: 'POST',
      originalUrl: '/api/v1/clubs',
      headers: { 'idempotency-key': 'key-1' },
      body: { name: 'AI Society' },
    } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    // Simulate an existing in-flight lock in Redis
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({
        status: 'PROCESSING',
        fingerprint: 'dummy-fingerprint',
      }),
    );

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnprocessableEntityError));
  });

  it('should replay cached response immediately if request has already COMPLETED', async () => {
    const middleware = idempotency();
    const payload = { name: 'Stanford Robotics' };
    const req = {
      method: 'POST',
      originalUrl: '/api/v1/clubs',
      headers: { 'idempotency-key': 'key-123' },
      body: payload,
    } as Request;

    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    // Compute expected fingerprint
    const { createHash } = await import('crypto');
    const fingerprint = createHash('sha256')
      .update(`POST:/api/v1/clubs:${JSON.stringify(payload)}`)
      .digest('hex');

    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({
        status: 'COMPLETED',
        fingerprint,
        statusCode: 201,
        body: { success: true, clubId: 'club-999' },
      }),
    );

    await middleware(req, res, next);

    // Verifies controller was completely bypassed (next NOT called)
    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-Cache-Lookup', 'HIT - Idempotent Replay');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, clubId: 'club-999' });
  });
});
