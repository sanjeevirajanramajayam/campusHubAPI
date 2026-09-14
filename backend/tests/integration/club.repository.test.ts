import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClubRepository } from '../../src/modules/clubs/club.repository.js';
import { prisma } from '../../src/infrastructure/prisma/client.js';
import { resetDatabase, createTestUser } from '../helpers/test-helpers.js';

describe('PrismaClubRepository - Database Integration & Transactions', () => {
  const repo = new PrismaClubRepository();

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it('should create club and admin membership atomically in a single ACID transaction', async () => {
    const { user } = await createTestUser();

    const club = await repo.createWithAdmin({
      name: 'Stanford Autonomous Vehicle Lab',
      slug: 'stanford-autonomous-vehicle-lab',
      description: 'Researching LiDAR, path planning, and self-driving shuttles.',
      creatorId: user.id,
    });

    expect(club.id).toBeDefined();
    expect(club.name).toBe('Stanford Autonomous Vehicle Lab');

    // Verify ClubMember was created inside the same transaction
    const membership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: club.id,
        },
      },
    });

    expect(membership).not.toBeNull();
    expect(membership!.role).toBe('ADMIN');
  });

  it('should rollback club creation if member creation fails (Atomic Rollback)', async () => {
    const nonExistentUserId = '00000000-0000-0000-0000-000000000000';

    // Attempt to create club with invalid creatorId -> Foreign key error on ClubMember
    await expect(
      repo.createWithAdmin({
        name: 'Ghost Club',
        slug: 'ghost-club',
        description: 'This club should never exist in the database.',
        creatorId: nonExistentUserId,
      }),
    ).rejects.toThrow();

    // Verify rollback: Club must NOT exist in the database!
    const ghostClub = await prisma.club.findUnique({
      where: { slug: 'ghost-club' },
    });
    expect(ghostClub).toBeNull();
  });

  it('should enforce PostgreSQL unique constraints on slug and name', async () => {
    const { user } = await createTestUser();

    await repo.createWithAdmin({
      name: 'Stanford Solar Car Project',
      slug: 'stanford-solar-car-project',
      description: 'Designing and racing solar-powered vehicles in the Australian Outback.',
      creatorId: user.id,
    });

    // Attempt duplicate slug creation -> PostgreSQL P2002 error
    await expect(
      repo.createWithAdmin({
        name: 'Different Name Same Slug',
        slug: 'stanford-solar-car-project',
        description: 'Colliding slug test.',
        creatorId: user.id,
      }),
    ).rejects.toThrow();
  });
});
