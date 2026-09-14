import type { Club, ClubMember } from '@prisma/client';
import type { IClubRepository, ClubWithMemberCount } from './club.repository.interface.js';
import { PrismaClubRepository } from './club.repository.js';
import type { CreateClubInput, UpdateClubInput } from './club.dto.js';
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../common/errors/app-error.js';

/**
 * Club Domain Service
 *
 * WHY:
 * 1. Constructor Dependency Injection allows unit testing without PostgreSQL.
 * 2. Enforces business rules: slug uniqueness, member duplicates, preventing
 *    abandonment of clubs by the sole administrator.
 */
export class ClubService {
  constructor(private readonly clubRepo: IClubRepository = new PrismaClubRepository()) {}

  /**
   * Transforms a human-readable club name into a URL-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // strip special characters
      .replace(/[\s_-]+/g, '-') // replace spaces and underscores with a single hyphen
      .replace(/^-+|-+$/g, ''); // strip leading and trailing hyphens
  }

  /**
   * Generates a collision-resistant unique slug
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let candidateSlug = baseSlug;
    let counter = 1;

    while (await this.clubRepo.findBySlug(candidateSlug)) {
      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    return candidateSlug;
  }

  async createClub(creatorId: string, input: CreateClubInput): Promise<Club> {
    const existingName = await this.clubRepo.findByName(input.name);
    if (existingName) {
      throw new ConflictError('A club with this name already exists');
    }

    const slug = await this.generateUniqueSlug(input.name);

    return this.clubRepo.createWithAdmin({
      name: input.name,
      slug,
      description: input.description,
      bannerUrl: input.bannerUrl,
      creatorId,
    });
  }

  async getAllClubs(limit = 20, offset = 0): Promise<ClubWithMemberCount[]> {
    return this.clubRepo.findAll(limit, offset);
  }

  async getClubBySlug(slug: string): Promise<Club> {
    const club = await this.clubRepo.findBySlug(slug);
    if (!club) {
      throw new NotFoundError('Club not found');
    }
    return club;
  }

  async getClubById(id: string): Promise<Club> {
    const club = await this.clubRepo.findById(id);
    if (!club) {
      throw new NotFoundError('Club not found');
    }
    return club;
  }

  async joinClub(clubId: string, userId: string): Promise<ClubMember> {
    const club = await this.getClubById(clubId);

    const existingMembership = await this.clubRepo.getMembership(club.id, userId);
    if (existingMembership) {
      throw new ConflictError('You are already a member of this club');
    }

    return this.clubRepo.addMember(club.id, userId, 'MEMBER');
  }

  async leaveClub(clubId: string, userId: string): Promise<void> {
    const membership = await this.clubRepo.getMembership(clubId, userId);
    if (!membership) {
      throw new NotFoundError('You are not a member of this club');
    }

    // Business Rule: Club Admin cannot abandon the club without transferring ownership
    if (membership.role === 'ADMIN') {
      throw new BadRequestError(
        'As the club administrator, you must transfer ownership before leaving',
      );
    }

    await this.clubRepo.removeMember(clubId, userId);
  }

  async updateClub(clubId: string, userId: string, input: UpdateClubInput): Promise<Club> {
    const membership = await this.clubRepo.getMembership(clubId, userId);
    if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'LEAD')) {
      throw new ForbiddenError('Only club leaders or admins can update club information');
    }

    return this.clubRepo.update(clubId, input);
  }
}
