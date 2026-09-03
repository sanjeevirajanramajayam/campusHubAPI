import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { errorHandler } from './middleware/error.middleware.js';
import { NotFoundError } from './common/errors/app-error.js';

import cookieParser from 'cookie-parser';
import { createAuthRouter } from './modules/auth/auth.routes.js';

export const createApp = (): Application => {
  const app = express();

  // 1. Security HTTP Headers
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // 3. Body & Cookie Parsing Middleware (with size limits to prevent DoS payload attacks)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. Request Logging Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info({
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    });
    next();
  });

  // 5. System Health Check Endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
      },
    });
  });

  // 6. Base API Router
  const apiRouter = express.Router();
  apiRouter.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Welcome to CampusHub API',
      version: 'v1',
    });
  });

  // Mount Auth Module
  apiRouter.use('/auth', createAuthRouter());

  // Mount API Router under configured prefix (e.g. /api/v1)
  app.use(env.API_PREFIX, apiRouter);

  // 7. 404 Handler for undefined routes
  app.use((req: Request) => {
    throw new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  });

  // 8. Global Centralized Error Handler (must be last middleware)
  app.use(errorHandler);

  return app;
};
