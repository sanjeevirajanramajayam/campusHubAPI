import type { Club, ClubMember, ClubRole } from '@prisma/client';

export interface CreateClubDTO {
  name: string;
  slug: string;
  description: string;
  bannerUrl?: string | null;
  creatorId: string;
}

export interface ClubWithMemberCount extends Club {
  _count: {
    members: number;
    events: number;
  };
}

/**
 * Club Repository Interface (Abstraction Contract)
 * 
 * WHY:
 * 1. Decouples Club and Membership queries from Prisma ORM details.
 * 2. createWithAdmin() encapsulates a critical ACID transaction: creating the club
 *    and assigning the creator as an ADMIN member atomically in a single transaction.
 */
export interface IClubRepository {
  createWithAdmin(data: CreateClubDTO): Promise<Club>;
  findById(id: string): Promise<Club | null>;
  findBySlug(slug: string): Promise<Club | null>;
  findByName(name: string): Promise<Club | null>;
  findAll(limit?: number, offset?: number): Promise<ClubWithMemberCount[]>;
  update(id: string, data: Partial<Pick<CreateClubDTO, 'name' | 'description' | 'bannerUrl'>>): Promise<Club>;
  addMember(clubId: string, userId: string, role?: ClubRole): Promise<ClubMember>;
  removeMember(clubId: string, userId: string): Promise<void>;
  getMembership(clubId: string, userId: string): Promise<ClubMember | null>;
}
