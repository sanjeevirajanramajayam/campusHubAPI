import { prisma } from '../../src/infrastructure/prisma/client.js';
import { redis } from '../../src/infrastructure/redis/client.js';
import { jwtService } from '../../src/common/security/jwt.service.js';
import { passwordService } from '../../src/common/security/password.service.js';
import type { Role } from '@prisma/client';

/**
 * Resets all tables in the PostgreSQL database between integration tests.
 * Tables are truncated/deleted in foreign-key dependency order.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.clubMember.deleteMany();
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Flushes all keys from Redis test database.
 */
export async function resetRedis(): Promise<void> {
  await redis.flushall();
}

/**
 * Creates a verified test user with a specified role and returns both
 * the user record and a signed access token for authenticated requests.
 */
export async function createTestUser(role: Role = 'STUDENT') {
  const uniqueId = Math.random().toString(36).substring(2, 8);
  const email = `test.${uniqueId}@stanford.edu`;
  const password = 'StrongPassword123!';
  const passwordHash = await passwordService.hash(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Test',
      lastName: `User_${uniqueId}`,
      role,
      isVerified: true,
    },
  });

  const accessToken = jwtService.generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { user, accessToken, password, email };
}
