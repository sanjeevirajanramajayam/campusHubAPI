import { z } from 'zod';

/**
 * Registration Input Schema
 *
 * Enforces input boundaries:
 * - Email lowercased and validated
 * - Minimum 8 character password
 * - First and last name required and trimmed
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address format').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password must not exceed 100 characters'),
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login Input Schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address format').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
