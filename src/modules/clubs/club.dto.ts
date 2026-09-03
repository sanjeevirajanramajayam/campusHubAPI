import { z } from 'zod';

/**
 * Zod Validation Schemas and DTO Types for Clubs
 * 
 * WHY:
 * 1. Strict input validation prevents over-posting attacks and malformed data.
 * 2. Inferred TypeScript types guarantee end-to-end type safety between controllers and services.
 */

export const createClubSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(3, 'Club name must be at least 3 characters long')
      .max(60, 'Club name cannot exceed 60 characters'),
    description: z
      .string()
      .trim()
      .min(10, 'Club description must be at least 10 characters long')
      .max(1000, 'Club description cannot exceed 1,000 characters'),
    bannerUrl: z.string().url('Invalid banner image URL').optional().nullable(),
  }),
});

export const updateClubSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(3, 'Club name must be at least 3 characters long')
      .max(60, 'Club name cannot exceed 60 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .min(10, 'Club description must be at least 10 characters long')
      .max(1000, 'Club description cannot exceed 1,000 characters')
      .optional(),
    bannerUrl: z.string().url('Invalid banner image URL').optional().nullable(),
  }),
});

export type CreateClubInput = z.infer<typeof createClubSchema>['body'];
export type UpdateClubInput = z.infer<typeof updateClubSchema>['body'];
