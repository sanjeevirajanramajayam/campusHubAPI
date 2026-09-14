import type { RefreshToken } from '@prisma/client';

export interface CreateRefreshTokenDTO {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

/**
 * Refresh Token Repository Interface (Contract)
 *
 * WHY:
 * 1. Encapsulates session persistence for Token Family Rotation.
 * 2. Provides atomic family revocation when token reuse/theft is detected.
 * 3. Keeps database query mechanics isolated from AuthService business logic.
 */
export interface IRefreshTokenRepository {
  create(data: CreateRefreshTokenDTO): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  markAsUsed(id: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
