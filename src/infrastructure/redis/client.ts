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
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info(`⚡ Connected to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on('error', (err: unknown) => {
  logger.error(err, 'Redis connection error');
});
