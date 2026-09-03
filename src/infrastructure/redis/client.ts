import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';

/**
 * Singleton Redis Client Instance
 *
 * WHY:
 * 1. Manages high-performance in-memory caching and token blacklists.
 * 2. Employs exponential backoff retry strategy for connection resilience.
 * 3. Handles connection lifecycle logging via EventEmitter hooks.
 */
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 100, 3000);
      },
    })
  : new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 100, 3000);
      },
    });

redis.on('connect', () => {
  const target = env.REDIS_URL ? 'via REDIS_URL' : `at ${env.REDIS_HOST}:${env.REDIS_PORT}`;
  logger.info(`⚡ Connected to Redis ${target}`);
});

redis.on('error', (err: unknown) => {
  logger.error(err, 'Redis connection error');
});
