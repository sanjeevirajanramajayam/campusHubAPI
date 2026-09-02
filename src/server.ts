import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { prisma } from './infrastructure/prisma/client.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 CampusHub Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
  logger.info(`👉 Health check available at: http://localhost:${env.PORT}/health`);
  logger.info(`👉 Base API endpoint: http://localhost:${env.PORT}${env.API_PREFIX}`);
});

/**
 * Graceful Shutdown Protocol
 * 
 * WHY:
 * When a container (Docker/Kubernetes) or deployment service terminates our process,
 * it sends a SIGTERM or SIGINT signal.
 * Graceful shutdown stops accepting new HTTP connections and allows in-flight
 * requests to complete cleanly before closing database pools and exiting.
 */
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed. Disconnecting database pools...');
    try {
      await prisma.$disconnect();
      logger.info('Database pool disconnected.');
    } catch (err) {
      logger.error({ err }, 'Error while disconnecting database pool');
    }
    logger.info('Clean shutdown complete.');
    process.exit(0);
  });

  // Force exit if shutdown takes too long (e.g. 10s timeout)
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Catch unhandled Promise rejections and uncaught exceptions
process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ err: reason }, 'Unhandled Promise Rejection detected!');
  process.exit(1);
});

process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err }, 'Uncaught Exception thrown!');
  process.exit(1);
});
