import type { User } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';
import type { IUserRepository, CreateUserDTO } from './user.repository.interface.js';

/**
 * Prisma Implementation of IUserRepository
 * 
 * WHY:
 * 1. Encapsulates all direct Prisma queries relating to the `User` model.
 * 2. Implements the IUserRepository contract, allowing it to be swapped or mocked.
 */
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserDTO): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Partial<CreateUserDTO>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  }
}
