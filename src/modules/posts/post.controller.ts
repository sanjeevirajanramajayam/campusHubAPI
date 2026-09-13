import type { Request, Response, NextFunction } from 'express';
import type { PostService } from './post.service.js';
import type { CreatePostInput, UpdatePostInput, PostQueryInput } from './post.dto.js';

export class PostController {
  constructor(private readonly postService: PostService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreatePostInput;
      const authorId = req.user!.id;

      const post = await this.postService.createPost(input, authorId);

      res.status(201).json({
        success: true,
        data: { post },
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const callerId = req.user?.id;

      const post = await this.postService.getPostById(id, callerId);

      res.status(200).json({
        success: true,
        data: { post },
      });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as PostQueryInput;
      const callerId = req.user?.id;

      const result = await this.postService.listPosts(query, callerId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const input = req.body as UpdatePostInput;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const post = await this.postService.updatePost(id, input, userId, userRole);

      res.status(200).json({
        success: true,
        data: { post },
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      await this.postService.deletePost(id, userId, userRole);

      res.status(200).json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const userId = req.user!.id;

      const result = await this.postService.togglePostLike(id, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
