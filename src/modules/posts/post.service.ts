import { NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import type { IPostRepository, PostWithDetails } from './post.repository.interface.js';
import type { CreatePostInput, UpdatePostInput, PostQueryInput } from './post.dto.js';
import type { Post } from '@prisma/client';

export class PostService {
  constructor(private readonly postRepository: IPostRepository) {}

  async createPost(input: CreatePostInput, authorId: string): Promise<Post> {
    return this.postRepository.create({
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
      authorId,
    });
  }

  async getPostById(id: string, callerId?: string): Promise<PostWithDetails> {
    const post = await this.postRepository.findById(id, callerId);
    if (!post || post.isDeleted) {
      throw new NotFoundError('Post not found');
    }
    return post;
  }

  async listPosts(
    query: PostQueryInput,
    callerId?: string,
  ): Promise<{
    posts: PostWithDetails[];
    pagination: { page: number; limit: number; totalCount: number; totalPages: number };
  }> {
    const offset = (query.page - 1) * query.limit;
    const { posts, totalCount } = await this.postRepository.findAll(
      {
        tag: query.tag,
        clubId: query.clubId,
        search: query.search,
        sortBy: query.sortBy,
        limit: query.limit,
        offset,
      },
      callerId,
    );

    return {
      posts,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit),
      },
    };
  }

  async updatePost(
    id: string,
    input: UpdatePostInput,
    userId: string,
    userRole: string,
  ): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post || post.isDeleted) {
      throw new NotFoundError('Post not found');
    }

    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to edit this post');
    }

    return this.postRepository.update(id, input);
  }

  async deletePost(id: string, userId: string, userRole: string): Promise<void> {
    const post = await this.postRepository.findById(id);
    if (!post || post.isDeleted) {
      throw new NotFoundError('Post not found');
    }

    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to delete this post');
    }

    await this.postRepository.softDelete(id);
  }

  async togglePostLike(
    postId: string,
    userId: string,
  ): Promise<{ liked: boolean; totalLikes: number }> {
    const post = await this.postRepository.findById(postId);
    if (!post || post.isDeleted) {
      throw new NotFoundError('Post not found');
    }

    return this.postRepository.toggleLike(postId, userId);
  }
}
