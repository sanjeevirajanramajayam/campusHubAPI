import type { Request, Response } from 'express';
import type { EventService } from './event.service.js';
import type { CreateEventInput } from './event.dto.js';

export class EventController {
  constructor(private readonly eventService: EventService) {}

  createEvent = async (req: Request, res: Response): Promise<void> => {
    const clubId = req.params.clubId as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const input: CreateEventInput = req.body;

    const event = await this.eventService.createEvent(clubId, userId, userRole, input);

    res.status(201).json({
      success: true,
      data: { event },
    });
  };

  getAllEvents = async (req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const events = await this.eventService.getAllEvents(limit, offset);

    res.status(200).json({
      success: true,
      data: { events },
    });
  };

  getEventsByClub = async (req: Request, res: Response): Promise<void> => {
    const clubId = req.params.clubId as string;
    const events = await this.eventService.getEventsByClub(clubId);

    res.status(200).json({
      success: true,
      data: { events },
    });
  };

  getEventById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const event = await this.eventService.getEventById(id);

    res.status(200).json({
      success: true,
      data: { event },
    });
  };

  registerForEvent = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const registration = await this.eventService.registerForEvent(id, userId);

    res.status(201).json({
      success: true,
      data: { registration },
    });
  };
}
