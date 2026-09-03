import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClubService } from '../../src/modules/clubs/club.service.js';
import type { IClubRepository } from '../../src/modules/clubs/club.repository.interface.js';
import { ConflictError, NotFoundError } from '../../src/common/errors/app-error.js';

describe('ClubService', () => {
  let clubService: ClubService;
  let mockClubRepo: IClubRepository;

  const mockClub = {
    id: 'club-123',
    name: 'Stanford Robotics Society',
    slug: 'stanford-robotics-society',
    description: 'Autonomous robotics and computer vision.',
    bannerUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockClubRepo = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByName: vi.fn(),
      findAll: vi.fn(),
      createWithAdmin: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addMember: vi.fn(),
      getMembership: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      countMembersByRole: vi.fn(),
    };

    clubService = new ClubService(mockClubRepo);
  });

  describe('createClub', () => {
    it('should generate a URL-safe slug and create club with initial admin', async () => {
      vi.mocked(mockClubRepo.findByName).mockResolvedValue(null);
      vi.mocked(mockClubRepo.findBySlug).mockResolvedValue(null);
      vi.mocked(mockClubRepo.createWithAdmin).mockResolvedValue(mockClub as any);

      const result = await clubService.createClub('user-admin-1', {
        name: 'Stanford Robotics Society',
        description: 'Autonomous robotics and computer vision.',
      });

      expect(result.slug).toBe('stanford-robotics-society');
      expect(mockClubRepo.findBySlug).toHaveBeenCalledWith('stanford-robotics-society');
      expect(mockClubRepo.createWithAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Stanford Robotics Society',
          slug: 'stanford-robotics-society',
          creatorId: 'user-admin-1',
        }),
      );
    });

    it('should handle slug collisions by appending an incremental suffix', async () => {
      vi.mocked(mockClubRepo.findByName).mockResolvedValue(null);
      // First lookup finds a collision, second lookup finds availability
      vi.mocked(mockClubRepo.findBySlug)
        .mockResolvedValueOnce(mockClub as any)
        .mockResolvedValueOnce(null);

      vi.mocked(mockClubRepo.createWithAdmin).mockResolvedValue({
        ...mockClub,
        slug: 'stanford-robotics-society-1',
      } as any);

      const result = await clubService.createClub('user-admin-1', {
        name: 'Stanford Robotics Society',
        description: 'Autonomous robotics and computer vision.',
      });

      expect(result.slug).toBe('stanford-robotics-society-1');
      expect(mockClubRepo.findBySlug).toHaveBeenCalledTimes(2);
    });
  });

  describe('joinClub', () => {
    it('should throw NotFoundError if club does not exist', async () => {
      vi.mocked(mockClubRepo.findById).mockResolvedValue(null);

      await expect(clubService.joinClub('non-existent-id', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if user is already a member', async () => {
      vi.mocked(mockClubRepo.findById).mockResolvedValue(mockClub as any);
      vi.mocked(mockClubRepo.getMembership).mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        clubId: 'club-123',
        role: 'MEMBER',
        joinedAt: new Date(),
      } as any);

      await expect(clubService.joinClub('club-123', 'user-1')).rejects.toThrow(ConflictError);
    });

    it('should successfully add user as MEMBER if not already joined', async () => {
      vi.mocked(mockClubRepo.findById).mockResolvedValue(mockClub as any);
      vi.mocked(mockClubRepo.getMembership).mockResolvedValue(null);
      vi.mocked(mockClubRepo.addMember).mockResolvedValue({
        id: 'mem-new',
        userId: 'user-1',
        clubId: 'club-123',
        role: 'MEMBER',
        joinedAt: new Date(),
      } as any);

      const membership = await clubService.joinClub('club-123', 'user-1');
      expect(membership.role).toBe('MEMBER');
      expect(mockClubRepo.addMember).toHaveBeenCalledWith('club-123', 'user-1', 'MEMBER');
    });
  });
});
