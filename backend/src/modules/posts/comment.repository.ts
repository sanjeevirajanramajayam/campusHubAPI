import type { Comment } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';
import type {
  ICommentRepository,
  CreateCommentDTO,
  UpdateCommentDTO,
  CommentWithDetails,
} from './comment.repository.interface.js';

export class PrismaCommentRepository implements ICommentRepository {
  async create(data: CreateCommentDTO): Promise<Comment> {
    return prisma.comment.create({
      data: {
        postId: data.postId,
        authorId: data.authorId,
        content: data.content,
        parentId: data.parentId ?? null,
      },
    });
  }

  async findById(id: string): Promise<Comment | null> {
    return prisma.comment.findUnique({
      where: { id },
    });
  }

  async findByPostId(postId: string, callerId?: string): Promise<CommentWithDetails[]> {
    const rawComments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
        likes: callerId
          ? {
              where: { userId: callerId },
              select: { id: true },
            }
          : false,
      },
    });

    const commentMap = new Map<string, CommentWithDetails>();
    const rootComments: CommentWithDetails[] = [];

    // Map all comments with like state
    for (const raw of rawComments) {
      const { likes, ...rest } = raw as typeof raw & { likes?: { id: string }[] };
      const commentWithDetails: CommentWithDetails = {
        ...rest,
        isLikedByCaller: Array.isArray(likes) && likes.length > 0,
        replies: [],
      };
      commentMap.set(commentWithDetails.id, commentWithDetails);
    }

    // Assemble adjacency tree
    for (const comment of commentMap.values()) {
      if (comment.parentId && commentMap.has(comment.parentId)) {
        commentMap.get(comment.parentId)!.replies!.push(comment);
      } else if (!comment.parentId) {
        rootComments.push(comment);
      }
    }

    return rootComments;
  }

  async update(id: string, data: UpdateCommentDTO): Promise<Comment> {
    return prisma.comment.update({
      where: { id },
      data: {
        content: data.content,
        isEdited: true,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.comment.update({
      where: { id },
      data: {
        isDeleted: true,
        content: '[This comment was deleted by author]',
      },
    });
  }

  async toggleLike(
    commentId: string,
    userId: string,
  ): Promise<{ liked: boolean; totalLikes: number }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.commentLike.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      if (existing) {
        await tx.commentLike.delete({
          where: { id: existing.id },
        });
        const totalLikes = await tx.commentLike.count({ where: { commentId } });
        return { liked: false, totalLikes };
      } else {
        await tx.commentLike.create({
          data: {
            commentId,
            userId,
          },
        });
        const totalLikes = await tx.commentLike.count({ where: { commentId } });
        return { liked: true, totalLikes };
      }
    });
  }

  async calculateDepth(commentId: string): Promise<number> {
    let depth = 1;
    let current = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { parentId: true },
    });

    while (current?.parentId) {
      depth++;
      current = await prisma.comment.findUnique({
        where: { id: current.parentId },
        select: { parentId: true },
      });
    }

    return depth;
  }
}
