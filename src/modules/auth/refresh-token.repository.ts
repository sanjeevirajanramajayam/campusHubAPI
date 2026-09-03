import type { RefreshToken } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';
import type { IRefreshTokenRepository, CreateRefreshTokenDTO } from './refresh-token.repository.interface.js';

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  async create(data: CreateRefreshTokenDTO): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  async markAsUsed(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { isUsed: true },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    // ⚡ Nuclear Revocation: Wipes all active and rotated tokens in the compromised family!
    await prisma.refreshToken.deleteMany({
      where: { familyId },
    });
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
