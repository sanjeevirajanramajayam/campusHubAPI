import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaUserRepository } from '../users/user.repository.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { registerSchema, loginSchema } from './auth.dto.js';

/**
 * Creates and configures the Express Authentication Router
 *
 * Composition Root for the Auth Module:
 * Instantiates PrismaUserRepository -> AuthService -> AuthController
 */
export const createAuthRouter = (): Router => {
  const router = Router();

  const userRepo = new PrismaUserRepository();
  const authService = new AuthService(userRepo);
  const authController = new AuthController(authService);

  router.post('/register', validate(registerSchema), authController.register);
  router.post('/login', validate(loginSchema), authController.login);
  router.post('/refresh', authController.refresh);
  router.post('/logout', authController.logout);
  router.get('/me', authenticate, authController.getMe);

  return router;
};
