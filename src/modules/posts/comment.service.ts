import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/app-error.js';
import type { ICommentRepository, CommentWithDetails } from './comment.repository.interface.js';
import type { IPostRepository } from './post.repository.interface.js';
import type { CreateCommentInput, UpdateCommentInput } from './post.dto.js';
import type { Comment } from '@prisma/client';

export class CommentService {
  constructor(
    private readonly commentRepository: ICommentRepository,
    private readonly postRepository: IPostRepository,
  ) {}

  async createComment(
    postId: string,
    input: CreateCommentInput,
    authorId: string,
  ): Promise<Comment> {
    const post = await this.postRepository.findById(postId);
    if (!post || post.isDeleted) {
      throw new NotFoundError('Post not found');
    }

    if (input.parentId) {
      const parent = await this.commentRepository.findById(input.parentId);
      if (!parent || parent.postId !== postId || parent.isDeleted) {
        throw new NotFoundError('Parent comment not found on this post');
      }

      // ⚡ Enforce BR-COMM-003: Maximum 3-level nesting depth (Post -> Top-level -> Reply)
      const currentDepth = await this.commentRepository.calculateDepth(input.parentId);
      if (currentDepth >= 3) {
        throw new BadRequestError(
          'Maximum reply nesting depth of 3 levels reached for this discussion thread',
        );
      }
    }

    return this.commentRepository.create({
      postId,
      authorId,
      content: input.content,
      parentId: input.parentId,
    });
  }

  async listCommentsByPost(postId: string, callerId?: string): Promise<CommentWithDetails[]> {
    const post = await this.postRepository.findById(postId);
    if (!post || post.isDeleted) {
      throw new NotFoundError('Post not found');
    }

    return this.commentRepository.findByPostId(postId, callerId);
  }

  async updateComment(
    commentId: string,
    input: UpdateCommentInput,
    userId: string,
    userRole: string,
  ): Promise<Comment> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment || comment.isDeleted) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to edit this comment');
    }

    return this.commentRepository.update(commentId, input);
  }

  async deleteComment(commentId: string, userId: string, userRole: string): Promise<void> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment || comment.isDeleted) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to delete this comment');
    }

    await this.commentRepository.softDelete(commentId);
  }

  async toggleCommentLike(
    commentId: string,
    userId: string,
  ): Promise<{ liked: boolean; totalLikes: number }> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment || comment.isDeleted) {
      throw new NotFoundError('Comment not found');
    }

    return this.commentRepository.toggleLike(commentId, userId);
  }
}
