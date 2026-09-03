import { Router } from 'express';
import { ClubController } from './club.controller.js';
import { ClubService } from './club.service.js';
import { PrismaClubRepository } from './club.repository.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { createClubSchema } from './club.dto.js';

/**
 * Creates and configures the Express Club Router
 * 
 * Composition Root for the Club Module:
 * Instantiates PrismaClubRepository -> ClubService -> ClubController
 */
export const createClubRouter = (): Router => {
  const router = Router();

  const clubRepo = new PrismaClubRepository();
  const clubService = new ClubService(clubRepo);
  const clubController = new ClubController(clubService);

  // Public Routes (Browsing clubs is public)
  router.get('/', clubController.getAll);
  router.get('/:slug', clubController.getBySlug);

  // Protected Routes (Creation and membership require authenticated session)
  router.post('/', authenticate, validate(createClubSchema), clubController.create);
  router.post('/:id/join', authenticate, clubController.join);
  router.delete('/:id/leave', authenticate, clubController.leave);

  return router;
};
