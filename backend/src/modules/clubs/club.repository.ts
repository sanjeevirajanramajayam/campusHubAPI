import type { Club, ClubMember, ClubRole } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';
import type {
  IClubRepository,
  CreateClubDTO,
  ClubWithMemberCount,
} from './club.repository.interface.js';

export class PrismaClubRepository implements IClubRepository {
  async createWithAdmin(data: CreateClubDTO): Promise<Club> {
    // ⚡ ACID Transaction: The club and the initial ADMIN membership are created together!
    // If membership creation fails, the club is rolled back.
    return prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          bannerUrl: data.bannerUrl,
        },
      });

      await tx.clubMember.create({
        data: {
          clubId: club.id,
          userId: data.creatorId,
          role: 'ADMIN',
        },
      });

      return club;
    });
  }

  async findById(id: string): Promise<Club | null> {
    return prisma.club.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Club | null> {
    return prisma.club.findUnique({
      where: { slug },
    });
  }

  async findByName(name: string): Promise<Club | null> {
    return prisma.club.findUnique({
      where: { name },
    });
  }

  async findAll(limit = 20, offset = 0): Promise<ClubWithMemberCount[]> {
    return prisma.club.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            members: true,
            events: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: Partial<Pick<CreateClubDTO, 'name' | 'description' | 'bannerUrl'>>,
  ): Promise<Club> {
    return prisma.club.update({
      where: { id },
      data,
    });
  }

  async addMember(clubId: string, userId: string, role: ClubRole = 'MEMBER'): Promise<ClubMember> {
    return prisma.clubMember.create({
      data: {
        clubId,
        userId,
        role,
      },
    });
  }

  async removeMember(clubId: string, userId: string): Promise<void> {
    await prisma.clubMember.delete({
      where: {
        userId_clubId: {
          userId,
          clubId,
        },
      },
    });
  }

  async getMembership(clubId: string, userId: string): Promise<ClubMember | null> {
    return prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId,
          clubId,
        },
      },
    });
  }
}
