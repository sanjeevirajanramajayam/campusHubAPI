import type { Event, EventRegistration } from '@prisma/client';
import type { CreateEventInput } from './event.dto.js';

export interface IEventRepository {
  create(clubId: string, input: CreateEventInput): Promise<Event>;
  findById(id: string): Promise<Event | null>;
  findAll(limit?: number, offset?: number): Promise<Event[]>;
  findAllByClub(clubId: string): Promise<Event[]>;
  findRegistration(eventId: string, userId: string): Promise<EventRegistration | null>;

  /**
   * High-Concurrency Ticket Reservation using Pessimistic Row-Level Locking (SELECT FOR UPDATE)
   *
   * ACID Guarantees:
   * 1. Acquires an exclusive row lock on the Event tuple in PostgreSQL (`xmax` header).
   * 2. Prevents overselling under high concurrency (e.g. 500 simultaneous requests).
   * 3. Atomically increments `registered_count` and issues the unique ticket pass.
   */
  registerStudentWithLock(
    eventId: string,
    userId: string,
    ticketCode: string,
  ): Promise<EventRegistration>;
}
