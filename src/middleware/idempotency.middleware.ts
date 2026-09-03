import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { redis } from '../infrastructure/redis/client.js';
import { ConflictError, UnprocessableEntityError } from '../common/errors/app-error.js';

interface IdempotencyRecord {
  status: 'PROCESSING' | 'COMPLETED';
  fingerprint: string;
  statusCode?: number;
  body?: unknown;
}

const DEFAULT_TTL_SECONDS = 86400; // 24 Hours
const LOCK_TTL_SECONDS = 120;       // 2 Minutes (in-flight timeout)

/**
 * Reusable Idempotency Middleware (RFC 9440 & Stripe Specification)
 * 
 * WHY:
 * 1. Prevents duplicate state mutations (e.g. double charging, duplicate registrations)
 *    when network drops cause clients to retry requests.
 * 2. Uses atomic Redis SET NX EX to lock requests during in-flight processing.
 * 3. Enforces payload fingerprinting (SHA-256) to detect key tampering/mismatch.
 * 4. Transparently replays completed responses without touching controllers or databases.
 */
export const idempotency = (ttlSeconds = DEFAULT_TTL_SECONDS) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only enforce idempotency on state-changing methods
    if (req.method !== 'POST' && req.method !== 'PATCH') {
      next();
      return;
    }

    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      next();
      return;
    }

    const redisKey = `idemp:${idempotencyKey}`;

    // Cryptographic Payload Fingerprint
    const requestFingerprint = createHash('sha256')
      .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? {})}`)
      .digest('hex');

    try {
      // 1. Check if response is already cached or processing
      const existingRaw = await redis.get(redisKey);

      if (existingRaw) {
        const record: IdempotencyRecord = JSON.parse(existingRaw);

        // Tampering Guard: Payload must match previous request
        if (record.fingerprint !== requestFingerprint) {
          throw new UnprocessableEntityError(
            'Idempotency key was previously used with a different request payload'
          );
        }

        // Concurrency Guard: Request still in flight
        if (record.status === 'PROCESSING') {
          throw new ConflictError(
            'A request with this idempotency key is currently being processed. Please wait.'
          );
        }

        // 🎯 REPLAY CACHED RESPONSE
        res.setHeader('X-Cache-Lookup', 'HIT - Idempotent Replay');
        res.status(record.statusCode ?? 200).json(record.body);
        return;
      }

      // 2. Acquire Atomic In-Flight Lock (NX = only if not exists)
      const lockAcquired = await redis.set(
        redisKey,
        JSON.stringify({
          status: 'PROCESSING',
          fingerprint: requestFingerprint,
        }),
        'EX',
        LOCK_TTL_SECONDS,
        'NX'
      );

      if (!lockAcquired) {
        throw new ConflictError(
          'A concurrent request with this idempotency key is already running.'
        );
      }

      // 3. Intercept `res.send` to capture response status and body
      const originalSend = res.send.bind(res);

      res.send = (body: unknown): Response => {
        let parsedBody = body;
        try {
          if (typeof body === 'string') {
            parsedBody = JSON.parse(body);
          }
        } catch {
          parsedBody = body;
        }

        const completedRecord: IdempotencyRecord = {
          status: 'COMPLETED',
          fingerprint: requestFingerprint,
          statusCode: res.statusCode,
          body: parsedBody,
        };

        // Cache completed response in Redis with TTL
        redis
          .set(redisKey, JSON.stringify(completedRecord), 'EX', ttlSeconds)
          .catch((err) => console.error('Failed to cache idempotent response:', err));

        return originalSend(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};
