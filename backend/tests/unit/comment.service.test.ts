import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentService } from '../../src/modules/posts/comment.service.js';
import type {
  ICommentRepository,
  CommentWithDetails,
} from '../../src/modules/posts/comment.repository.interface.js';
import type { IPostRepository } from '../../src/modules/posts/post.repository.interface.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../src/common/errors/app-error.js';
import type { Comment, Post } from '@prisma/client';

describe('CommentService', () => {
  let commentService: CommentService;
  let mockCommentRepo: ICommentRepository;
  let mockPostRepo: IPostRepository;

  const mockPost = {
    id: 'post-1',
    authorId: 'author-1',
    title: 'Test Post',
    content: 'Content',
    tags: [],
    isDeleted: false,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: { id: 'author-1', firstName: 'John', lastName: 'Doe', avatarUrl: null },
    _count: { comments: 1, likes: 0 },
  } as unknown as Post;

  const mockComment: Comment = {
    id: 'comment-1',
    postId: 'post-1',
    authorId: 'author-2',
    parentId: null,
    content: 'Great post!',
    isDeleted: false,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCommentWithDetails: CommentWithDetails = {
    ...mockComment,
    author: {
      id: 'author-2',
      firstName: 'Alice',
      lastName: 'Smith',
      avatarUrl: null,
    },
    _count: {
      likes: 2,
      replies: 0,
    },
    isLikedByCaller: false,
    replies: [],
  };

  beforeEach(() => {
    mockCommentRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPostId: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      toggleLike: vi.fn(),
      calculateDepth: vi.fn(),
    };
    mockPostRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      toggleLike: vi.fn(),
    };
    commentService = new CommentService(mockCommentRepo, mockPostRepo);
  });

  describe('createComment', () => {
    it('should create top-level comment when parentId is null', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPost as any);
      vi.mocked(mockCommentRepo.create).mockResolvedValue(mockComment);

      const result = await commentService.createComment(
        'post-1',
        { content: 'Great post!' },
        'author-2',
      );

      expect(result).toEqual(mockComment);
      expect(mockCommentRepo.create).toHaveBeenCalledWith({
        postId: 'post-1',
        authorId: 'author-2',
        content: 'Great post!',
        parentId: undefined,
      });
    });

    it('should throw NotFoundError if post does not exist', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(null);

      await expect(
        commentService.createComment('non-existent', { content: 'Hello' }, 'author-2'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should create nested reply when depth < 3', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPost as any);
      vi.mocked(mockCommentRepo.findById).mockResolvedValue(mockComment);
      vi.mocked(mockCommentRepo.calculateDepth).mockResolvedValue(2);
      vi.mocked(mockCommentRepo.create).mockResolvedValue({
        ...mockComment,
        id: 'reply-1',
        parentId: 'comment-1',
      });

      const result = await commentService.createComment(
        'post-1',
        { content: 'I agree!', parentId: 'comment-1' },
        'author-3',
      );

      expect(result.id).toBe('reply-1');
      expect(mockCommentRepo.calculateDepth).toHaveBeenCalledWith('comment-1');
    });

    it('should enforce BR-COMM-003 and reject reply if current depth >= 3', async () => {
      vi.mocked(mockPostRepo.findById).mockResolvedValue(mockPost as any);
      vi.mocked(mockCommentRepo.findById).mockResolvedValue(mockComment);
      vi.mocked(mockCommentRepo.calculateDepth).mockResolvedValue(3); // Already at level 3

      await expect(
        commentService.createComment(
          'post-1',
          { content: 'Too deep', parentId: 'comment-1' },
          'author-4',
        ),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('updateComment', () => {
    it('should allow author to update comment', async () => {
      vi.mocked(mockCommentRepo.findById).mockResolvedValue(mockComment);
      vi.mocked(mockCommentRepo.update).mockResolvedValue({
        ...mockComment,
        content: 'Updated comment text',
      });

      const result = await commentService.updateComment(
        'comment-1',
        { content: 'Updated comment text' },
        'author-2',
        'STUDENT',
      );

      expect(result.content).toBe('Updated comment text');
    });

    it('should throw ForbiddenError when non-author tries to update comment', async () => {
      vi.mocked(mockCommentRepo.findById).mockResolvedValue(mockComment);

      await expect(
        commentService.updateComment(
          'comment-1',
          { content: 'Hacked' },
          'attacker-user',
          'STUDENT',
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('deleteComment', () => {
    it('should soft-delete comment when requested by author', async () => {
      vi.mocked(mockCommentRepo.findById).mockResolvedValue(mockComment);
      vi.mocked(mockCommentRepo.softDelete).mockResolvedValue();

      await commentService.deleteComment('comment-1', 'author-2', 'STUDENT');

      expect(mockCommentRepo.softDelete).toHaveBeenCalledWith('comment-1');
    });
  });

  describe('toggleCommentLike', () => {
    it('should toggle like on comment', async () => {
      vi.mocked(mockCommentRepo.findById).mockResolvedValue(mockComment);
      vi.mocked(mockCommentRepo.toggleLike).mockResolvedValue({ liked: true, totalLikes: 3 });

      const result = await commentService.toggleCommentLike('comment-1', 'user-5');

      expect(result).toEqual({ liked: true, totalLikes: 3 });
      expect(mockCommentRepo.toggleLike).toHaveBeenCalledWith('comment-1', 'user-5');
    });
  });
});
