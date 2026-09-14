import { z } from 'zod';

/**
 * Zod Schemas for Event Module
 */
export const createEventSchema = z
  .object({
    title: z.string().min(3, 'Event title must be at least 3 characters').max(100),
    description: z.string().min(10, 'Event description must be at least 10 characters'),
    location: z.string().min(2, 'Event location must be specified'),
    startTime: z.string().datetime({ message: 'Start time must be a valid ISO-8601 string' }),
    endTime: z.string().datetime({ message: 'End time must be a valid ISO-8601 string' }),
    capacity: z.number().int().positive('Capacity must be at least 1 seat').max(10000),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: 'End time must be strictly after start time',
    path: ['endTime'],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;
