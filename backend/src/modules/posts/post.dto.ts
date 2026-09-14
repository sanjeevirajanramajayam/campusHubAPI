import { z } from 'zod';

export const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Post title must be at least 5 characters')
    .max(120, 'Post title cannot exceed 120 characters'),
  content: z
    .string()
    .trim()
    .min(10, 'Post content must be at least 10 characters')
    .max(10000, 'Post content cannot exceed 10,000 characters'),
  tags: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2, 'Tag must be at least 2 characters')
        .max(25, 'Tag cannot exceed 25 characters'),
    )
    .max(5, 'A post can have at most 5 tags')
    .default([]),
});

export const updatePostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Post title must be at least 5 characters')
    .max(120, 'Post title cannot exceed 120 characters')
    .optional(),
  content: z
    .string()
    .trim()
    .min(10, 'Post content must be at least 10 characters')
    .max(10000, 'Post content cannot exceed 10,000 characters')
    .optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2, 'Tag must be at least 2 characters')
        .max(25, 'Tag cannot exceed 25 characters'),
    )
    .max(5, 'A post can have at most 5 tags')
    .optional(),
});

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(2, 'Comment must be at least 2 characters')
    .max(2000, 'Comment cannot exceed 2,000 characters'),
  parentId: z.string().uuid('Invalid parent comment UUID').optional().nullable(),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(2, 'Comment must be at least 2 characters')
    .max(2000, 'Comment cannot exceed 2,000 characters'),
});

export const postQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  cursor: z.string().trim().optional(),
  tag: z.string().trim().toLowerCase().optional(),
  clubId: z.string().trim().toLowerCase().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['latest', 'popular']).default('latest'),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type PostQueryInput = z.infer<typeof postQuerySchema>;
