import type { Post, User } from '@prisma/client';

export interface CreatePostDTO {
  title: string;
  content: string;
  tags: string[];
  authorId: string;
}

export interface UpdatePostDTO {
  title?: string;
  content?: string;
  tags?: string[];
}

export interface PostQueryFilters {
  tag?: string;
  clubId?: string;
  search?: string;
  sortBy?: 'latest' | 'popular';
  limit?: number;
  offset?: number;
}

export interface PostWithDetails extends Post {
  author: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  _count: {
    comments: number;
    likes: number;
  };
  isLikedByCaller?: boolean;
}

export interface IPostRepository {
  create(data: CreatePostDTO): Promise<Post>;
  findById(id: string, callerId?: string): Promise<PostWithDetails | null>;
  findAll(
    filters: PostQueryFilters,
    callerId?: string,
  ): Promise<{ posts: PostWithDetails[]; totalCount: number }>;
  update(id: string, data: UpdatePostDTO): Promise<Post>;
  softDelete(id: string): Promise<void>;
  toggleLike(postId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }>;
}
