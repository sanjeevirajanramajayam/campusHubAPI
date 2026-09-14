import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';

/**
 * Singleton Prisma Client Instance
 *
 * WHY A SINGLETON?
 * 1. Calling `new PrismaClient()` creates a fresh database connection pool (10 connections).
 * 2. Creating multiple instances across files or during development hot-reloads (`tsx watch`)
 *    rapidly exhausts PostgreSQL's connection limits (`FATAL: too many connections`).
 * 3. In development, we attach the instance to `globalThis` to preserve the active connection
 *    pool across hot-reloads without spawning orphan database connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : ['error'],
  });

// In development, log every generated SQL query and its execution time via Pino
if (env.NODE_ENV === 'development') {
  // @ts-expect-error - Event typing for query logger
  prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
    logger.debug(
      {
        query: e.query,
        params: e.params,
        durationMs: e.duration,
      },
      'Prisma SQL Query Executed',
    );
  });

  // Preserve instance on globalThis across hot-reloads
  globalForPrisma.prisma = prisma;
}
