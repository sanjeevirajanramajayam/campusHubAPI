import type { Event, EventRegistration } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';
import type { IEventRepository } from './event.repository.interface.js';
import type { CreateEventInput } from './event.dto.js';
import { ConflictError, NotFoundError } from '../../common/errors/app-error.js';

export class PrismaEventRepository implements IEventRepository {
  async create(clubId: string, input: CreateEventInput): Promise<Event> {
    return prisma.event.create({
      data: {
        clubId,
        title: input.title,
        description: input.description,
        location: input.location,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        capacity: input.capacity,
      },
    });
  }

  async findById(id: string): Promise<Event | null> {
    return prisma.event.findUnique({
      where: { id },
    });
  }

  async findAll(limit = 20, offset = 0): Promise<Event[]> {
    return prisma.event.findMany({
      take: limit,
      skip: offset,
      orderBy: { startTime: 'asc' },
    });
  }

  async findAllByClub(clubId: string): Promise<Event[]> {
    return prisma.event.findMany({
      where: { clubId },
      orderBy: { startTime: 'asc' },
    });
  }

  async findRegistration(eventId: string, userId: string): Promise<EventRegistration | null> {
    return prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });
  }

  /**
   * 🔒 High-Concurrency Ticket Registration with Pessimistic Row Locking
   *
   * WHY:
   * 1. Under high contention (e.g. 500 students trying to buy the last 2 tickets),
   *    a standard `findUnique` -> check -> `create` creates a TOCTOU race condition.
   * 2. `SELECT * FROM "events" WHERE "id" = $1 FOR UPDATE` locks that event row in PostgreSQL.
   * 3. Competing transactions queue up in the PostgreSQL kernel until this transaction commits.
   * 4. Guarantees registeredCount NEVER exceeds capacity.
   */
  async registerStudentWithLock(
    eventId: string,
    userId: string,
    ticketCode: string,
  ): Promise<EventRegistration> {
    return prisma.$transaction(async (tx) => {
      // 1. 🔒 Acquire exclusive row-level lock on the Event tuple
      const events = await tx.$queryRaw<
        Array<{
          id: string;
          capacity: number;
          registered_count: number;
        }>
      >`
        SELECT id, capacity, registered_count
        FROM "events"
        WHERE id = ${eventId}
        FOR UPDATE
      `;

      const event = events[0];

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      // 2. 🛡️ Concurrency Guard: Check capacity under the safety of the row lock
      if (event.registered_count >= event.capacity) {
        throw new ConflictError('Event is already at maximum capacity (Sold Out)');
      }

      // 3. 🛡️ Duplicate Prevention: Check if user already has a confirmed ticket
      const existingTicket = await tx.eventRegistration.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      });

      if (existingTicket) {
        throw new ConflictError('You are already registered for this event');
      }

      // 4. 📝 Increment registered_count atomically
      await tx.event.update({
        where: { id: eventId },
        data: {
          registeredCount: { increment: 1 },
        },
      });

      // 5. 🎟️ Issue the Ticket
      return tx.eventRegistration.create({
        data: {
          eventId,
          userId,
          ticketCode,
          status: 'CONFIRMED',
        },
      });
      // 🔓 Row lock automatically released upon transaction COMMIT!
    });
  }
}
