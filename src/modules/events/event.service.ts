import type { Event, EventRegistration } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { IEventRepository } from './event.repository.interface.js';
import type { IClubRepository } from '../clubs/club.repository.interface.js';
import type { CreateEventInput } from './event.dto.js';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';

export class EventService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly clubRepo: IClubRepository,
  ) {}

  /**
   * Schedule a new Event for a Club
   * Requires the caller to be an ADMIN or LEAD member of the club.
   */
  async createEvent(
    clubId: string,
    creatorId: string,
    userRole: string,
    input: CreateEventInput,
  ): Promise<Event> {
    const club = await this.clubRepo.findById(clubId);
    if (!club) {
      throw new NotFoundError('Club not found');
    }

    // Platform ADMINs can schedule events anywhere; otherwise check club membership role
    if (userRole !== 'ADMIN') {
      const membership = await this.clubRepo.getMembership(clubId, creatorId);
      if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'LEAD')) {
        throw new ForbiddenError('Only club leaders or administrators can create events');
      }
    }

    return this.eventRepo.create(clubId, input);
  }

  async getAllEvents(limit = 20, offset = 0): Promise<Event[]> {
    return this.eventRepo.findAll(limit, offset);
  }

  async getEventsByClub(clubId: string): Promise<Event[]> {
    const club = await this.clubRepo.findById(clubId);
    if (!club) {
      throw new NotFoundError('Club not found');
    }
    return this.eventRepo.findAllByClub(clubId);
  }

  async getEventById(id: string): Promise<Event> {
    const event = await this.eventRepo.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    return event;
  }

  /**
   * High-Concurrency Student Event Ticket Registration
   */
  async registerForEvent(eventId: string, userId: string): Promise<EventRegistration> {
    // Generate a secure, human-readable ticket pass code (e.g. TICK-A7B2C9DF)
    const ticketCode = `TICK-${randomBytes(4).toString('hex').toUpperCase()}`;

    // Delegates to the pessimistic row-locking repository method
    return this.eventRepo.registerStudentWithLock(eventId, userId, ticketCode);
  }
}
