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

  private decodeCursor(cursor: string): { id: string; createdAt: string } | null {
    try {
      const json = Buffer.from(cursor, 'base64').toString('utf8');
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed.id === 'string') return parsed;
      return null;
    } catch {
      return null;
    }
  }

  private encodeCursor(post: { id: string; createdAt: Date }): string {
    return Buffer.from(
      JSON.stringify({ id: post.id, createdAt: post.createdAt.toISOString() }),
    ).toString('base64');
  }

  async findAll(
    filters: PostQueryFilters,
    callerId?: string,
  ): Promise<{ posts: PostWithDetails[]; totalCount: number; nextCursor?: string | null; hasMore: boolean }> {
    const whereClause: Record<string, unknown> = {
      isDeleted: false,
    };

    const targetTag = filters.tag || filters.clubId;
    if (targetTag) {
      whereClause.tags = { has: targetTag.toLowerCase() };
    }

    if (filters.search) {
      const search = filters.search.trim();
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      filters.sortBy === 'popular'
        ? [{ likes: { _count: 'desc' as const } }, { createdAt: 'desc' as const }, { id: 'desc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const take = filters.limit ?? 10;
    const cursorData = filters.cursor ? this.decodeCursor(filters.cursor) : null;

    const queryArgs: Record<string, unknown> = {
      where: whereClause,
      orderBy,
      take: take + 1, // Fetch 1 extra to evaluate hasMore & nextCursor
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
    };

    if (cursorData) {
      queryArgs.cursor = { id: cursorData.id };
      queryArgs.skip = 1;
    } else if (filters.offset !== undefined) {
      queryArgs.skip = filters.offset;
    }

    const [rawPostsWithExtra, totalCount] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.post.findMany(queryArgs as any),
      prisma.post.count({ where: whereClause }),
    ]);

    const hasMore = rawPostsWithExtra.length > take;
    const rawPosts = hasMore ? rawPostsWithExtra.slice(0, take) : rawPostsWithExtra;
    const lastItem = rawPosts[rawPosts.length - 1];
    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem) : null;

    const posts: PostWithDetails[] = (rawPosts as unknown as (PostWithDetails & { likes?: { id: string }[] })[]).map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLikedByCaller: Array.isArray(likes) && likes.length > 0,
      };
    });

    return { posts, totalCount, nextCursor, hasMore };
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
