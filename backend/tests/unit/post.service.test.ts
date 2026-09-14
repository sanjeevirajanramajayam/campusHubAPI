import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostService } from '../../src/modules/posts/post.service.js';
import type { IPostRepository, PostWithDetails } from '../../src/modules/posts/post.repository.interface.js';
import { NotFoundError, ForbiddenError } from '../../src/common/errors/app-error.js';
import type { Post } from '@prisma/client';

describe('PostService', () => {
  let postService: PostService;
  let mockPostRepo: IPostRepository;

  const mockPost: Post = {
    id: 'post-123',
    authorId: 'user-1',
    title: 'Hackathon Partner Search',
    content: 'Looking for a frontend dev with React skills.',
    tags: ['hackathon', 'react'],
    isDeleted: false,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPostWithDetails: PostWithDetails = {
    ...mockPost,
    author: {
      id: 'user-1',
      firstName: 'Jane',
      lastName: 'Doe',
      avatarUrl: null,
    },
    _count: {
      comments: 3,
      likes: 10,
    },
    isLikedByCaller: false,
  };

  beforeEach(() => {
    mockPostRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      toggleLike: vi.fn(),
    };
    postService = new PostService(mockPostRepo);
  });

  describe('createPost', () => {
    it('should create and return a post', async () => {
      vi.mocked(mockPostRepo.create).mockResolvedValue(mockPost);

      const result = await postService.createPost(
        {
          title: 'Hackathon Partner Search',
          content: 'Looking for a frontend dev with React skills.',
          tags: ['hackathon', 'react'],
        },
        'user-1',
      );

      expect(result).toEqual(mockPost);
      expect(mockPostRepo.create).toHaveBeenCalledWith({
        title: 'Hackathon Partner Search',
        content: 'Looking for a frontend dev with React skills.',
        tags: ['hackathon', 'react'],
        authorId: 'user-1',
      });
    });
  });

  describe('getPostById', () => {
    it('should return post details when post exists and is not deleted', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPostWithDetails);

      const result = await postService.getPostById('post-123', 'caller-1');

      expect(result).toEqual(mockPostWithDetails);
      expect(mockPostRepo.findById).toHaveBeenCalledWith('post-123', 'caller-1');
    });

    it('should throw NotFoundError when post does not exist', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(null);

      await expect(postService.getPostById('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when post is soft-deleted', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue({
        ...mockPostWithDetails,
        isDeleted: true,
      });

      await expect(postService.getPostById('post-123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updatePost', () => {
    it('should allow author to update post', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPostWithDetails);
      vi.mocked(mockPostRepo.update).mockResolvedValue({
        ...mockPost,
        title: 'Updated Title',
        isEdited: true,
      });

      const result = await postService.updatePost(
        'post-123',
        { title: 'Updated Title' },
        'user-1',
        'STUDENT',
      );

      expect(result.title).toBe('Updated Title');
      expect(mockPostRepo.update).toHaveBeenCalledWith('post-123', { title: 'Updated Title' });
    });

    it('should throw ForbiddenError when non-author and non-admin attempts update', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPostWithDetails);

      await expect(
        postService.updatePost('post-123', { title: 'Hacked' }, 'attacker-user', 'STUDENT'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow platform ADMIN to update any post', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPostWithDetails);
      vi.mocked(mockPostRepo.update).mockResolvedValue({
        ...mockPost,
        title: 'Moderated Title',
      });

      const result = await postService.updatePost(
        'post-123',
        { title: 'Moderated Title' },
        'admin-user',
        'ADMIN',
      );

      expect(result.title).toBe('Moderated Title');
    });
  });

  describe('deletePost', () => {
    it('should soft-delete post when requested by author', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPostWithDetails);
      vi.mocked(mockPostRepo.softDelete).mockResolvedValue();

      await postService.deletePost('post-123', 'user-1', 'STUDENT');

      expect(mockPostRepo.softDelete).toHaveBeenCalledWith('post-123');
    });

    it('should throw ForbiddenError when unauthorized student tries to delete post', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPostWithDetails);

      await expect(
        postService.deletePost('post-123', 'attacker-user', 'STUDENT'),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('togglePostLike', () => {
    it('should toggle like on post', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPostWithDetails);
      vi.mocked(mockPostRepo.toggleLike).mockResolvedValue({ liked: true, totalLikes: 11 });

      const result = await postService.togglePostLike('post-123', 'user-2');

      expect(result).toEqual({ liked: true, totalLikes: 11 });
      expect(mockPostRepo.toggleLike).toHaveBeenCalledWith('post-123', 'user-2');
    });
  });
});
