import type { Comment, User } from '@prisma/client';

export interface CreateCommentDTO {
  postId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
}

export interface UpdateCommentDTO {
  content: string;
}

export interface CommentWithDetails extends Comment {
  author: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  _count: {
    likes: number;
    replies: number;
  };
  isLikedByCaller?: boolean;
  replies?: CommentWithDetails[];
}

export interface ICommentRepository {
  create(data: CreateCommentDTO): Promise<Comment>;
  findById(id: string): Promise<Comment | null>;
  findByPostId(postId: string, callerId?: string): Promise<CommentWithDetails[]>;
  update(id: string, data: UpdateCommentDTO): Promise<Comment>;
  softDelete(id: string): Promise<void>;
  toggleLike(commentId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }>;
  calculateDepth(commentId: string): Promise<number>;
}
