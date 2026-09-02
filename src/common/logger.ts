import pino from 'pino';
import { env } from '../config/env.js';

/**
 * High-Performance Structured Logger (Pino)
 * 
 * WHY:
 * 1. Synchronous `console.log` can block the Node.js event loop during high throughput.
 * 2. Pino emits machine-readable JSON logs in production, which log aggregation
 *    systems (Datadog, AWS CloudWatch, Grafana Loki) can index with zero parsing overhead.
 * 3. In development, we use `pino-pretty` to format logs into human-readable colors.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
