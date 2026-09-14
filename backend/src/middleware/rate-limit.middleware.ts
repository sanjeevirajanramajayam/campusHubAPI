import type { Request, Response, NextFunction } from 'express';
import { redis } from '../infrastructure/redis/client.js';
import { logger } from '../common/logger.js';
import { AppError } from '../common/errors/app-error.js';

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please slow down.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  scope: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Distributed Redis Sliding-Window Rate Limiter
 *
 * Algorithm:
 * 1. Tracks request timestamps in a Redis Sorted Set (ZSET).
 * 2. Purges stale timestamps older than `now - windowSeconds` using ZREMRANGEBYSCORE.
 * 3. Adds current timestamp with unique nonce.
 * 4. Checks ZCARD (total requests in sliding window).
 * 5. Fails open gracefully if Redis is unavailable to prevent total platform outage.
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowSeconds, maxRequests, scope, keyGenerator } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = keyGenerator
      ? keyGenerator(req)
      : req.user?.id || req.ip || req.socket.remoteAddress || 'anonymous';

    const key = `rate_limit:${scope}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const memberNonce = `${now}:${Math.random().toString(36).slice(2, 8)}`;

    try {
      // Atomic Redis Multi-pipeline
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, now, memberNonce);
      pipeline.zcard(key);
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      // results[2] is the zcard execution: [error, count]
      const requestCount =
        results && results[2] && typeof results[2][1] === 'number' ? (results[2][1] as number) : 1;

      const remaining = Math.max(0, maxRequests - requestCount);
      const resetTime = Math.ceil((now + windowSeconds * 1000) / 1000);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (requestCount > maxRequests) {
        res.setHeader('Retry-After', windowSeconds);
        throw new TooManyRequestsError(
          `Rate limit exceeded for ${scope}. Limit is ${maxRequests} requests per ${windowSeconds}s.`,
        );
      }

      next();
    } catch (err) {
      if (err instanceof AppError) {
        next(err);
        return;
      }
      // Fail open if Redis drops connection so user traffic is never blocked
      logger.warn({ err }, `Redis rate limiter error on ${key}; failing open`);
      next();
    }
  };
}
