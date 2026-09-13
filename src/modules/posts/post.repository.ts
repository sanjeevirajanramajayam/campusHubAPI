import type { Post } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';
import type {
  IPostRepository,
  CreatePostDTO,
  UpdatePostDTO,
  PostQueryFilters,
  PostWithDetails,
} from './post.repository.interface.js';

export class PrismaPostRepository implements IPostRepository {
  async create(data: CreatePostDTO): Promise<Post> {
    return prisma.post.create({
      data: {
        title: data.title,
        content: data.content,
        tags: data.tags,
        authorId: data.authorId,
      },
    });
  }

  async findById(id: string, callerId?: string): Promise<PostWithDetails | null> {
    const post = await prisma.post.findUnique({
      where: { id },
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
            comments: true,
            likes: true,
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

    if (!post) return null;

    const { likes, ...rest } = post as typeof post & { likes?: { id: string }[] };
    return {
      ...rest,
      isLikedByCaller: Array.isArray(likes) && likes.length > 0,
    };
  }

  async findAll(
    filters: PostQueryFilters,
    callerId?: string,
  ): Promise<{ posts: PostWithDetails[]; totalCount: number }> {
    const whereClause: Record<string, unknown> = {
      isDeleted: false,
    };

    if (filters.tag) {
      whereClause.tags = { has: filters.tag };
    }

    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      filters.sortBy === 'popular'
        ? [{ likes: { _count: 'desc' as const } }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

    const [rawPosts, totalCount] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
        orderBy,
        skip: filters.offset ?? 0,
        take: filters.limit ?? 10,
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
              comments: true,
              likes: true,
            },
          },
          likes: callerId
            ? {
                where: { userId: callerId },
                select: { id: true },
              }
            : false,
        },
      }),
      prisma.post.count({ where: whereClause }),
    ]);

    const posts: PostWithDetails[] = rawPosts.map((post) => {
      const { likes, ...rest } = post as typeof post & { likes?: { id: string }[] };
      return {
        ...rest,
        isLikedByCaller: Array.isArray(likes) && likes.length > 0,
      };
    });

    return { posts, totalCount };
  }

  async update(id: string, data: UpdatePostDTO): Promise<Post> {
    return prisma.post.update({
      where: { id },
      data: {
        ...data,
        isEdited: true,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.post.update({
      where: { id },
      data: {
        isDeleted: true,
        content: '[This post was deleted by author]',
      },
    });
  }

  async toggleLike(
    postId: string,
    userId: string,
  ): Promise<{ liked: boolean; totalLikes: number }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      if (existing) {
        await tx.postLike.delete({
          where: { id: existing.id },
        });
        const totalLikes = await tx.postLike.count({ where: { postId } });
        return { liked: false, totalLikes };
      } else {
        await tx.postLike.create({
          data: {
            postId,
            userId,
          },
        });
        const totalLikes = await tx.postLike.count({ where: { postId } });
        return { liked: true, totalLikes };
      }
    });
  }
}
