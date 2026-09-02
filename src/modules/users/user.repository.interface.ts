import type { User, Role } from '@prisma/client';

/**
 * Data Transfer Object for creating a new user
 * Encapsulates the exact input shape required at the data boundary
 */
export interface CreateUserDTO {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role?: Role;
}

/**
 * User Repository Interface (The Contract)
 * 
 * WHY:
 * 1. High-level services (AuthService, UserService) depend on this interface,
 *    adhering strictly to the Dependency Inversion Principle (D of SOLID).
 * 2. Decouples business logic from Prisma / PostgreSQL specifics.
 * 3. Enables fast unit testing using in-memory mock implementations.
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserDTO): Promise<User>;
  update(id: string, data: Partial<CreateUserDTO>): Promise<User>;
  delete(id: string): Promise<User>;
}
