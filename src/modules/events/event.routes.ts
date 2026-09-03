import { Router } from 'express';
import { PrismaEventRepository } from './event.repository.js';
import { PrismaClubRepository } from '../clubs/club.repository.js';
import { EventService } from './event.service.js';
import { EventController } from './event.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createEventSchema } from './event.dto.js';

export function createEventRouter(): Router {
  const router = Router({ mergeParams: true });

  const eventRepo = new PrismaEventRepository();
  const clubRepo = new PrismaClubRepository();
  const eventService = new EventService(eventRepo, clubRepo);
  const eventController = new EventController(eventService);

  // 1. Public / Authenticated Browse Endpoints
  router.get('/', eventController.getAllEvents);
  router.get('/:id', eventController.getEventById);

  // 2. High-Concurrency Event Registration (Requires JWT Authentication)
  router.post('/:id/register', authenticate, eventController.registerForEvent);

  return router;
}

/**
 * Creates sub-router mounted under /api/v1/clubs/:clubId/events
 */
export function createClubEventRouter(): Router {
  const router = Router({ mergeParams: true });

  const eventRepo = new PrismaEventRepository();
  const clubRepo = new PrismaClubRepository();
  const eventService = new EventService(eventRepo, clubRepo);
  const eventController = new EventController(eventService);

  // List events for a specific club
  router.get('/', eventController.getEventsByClub);

  // Schedule an event for this club (Requires Authenticated Club Lead or Admin)
  router.post('/', authenticate, validate(createEventSchema), eventController.createEvent);

  return router;
}
