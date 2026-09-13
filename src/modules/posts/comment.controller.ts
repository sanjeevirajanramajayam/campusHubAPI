import type { Request, Response, NextFunction } from 'express';
import type { CommentService } from './comment.service.js';
import type { CreateCommentInput, UpdateCommentInput } from './post.dto.js';

export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const postId = req.params.postId as string;
      const input = req.body as CreateCommentInput;
      const authorId = req.user!.id;

      const comment = await this.commentService.createComment(postId, input, authorId);

      res.status(201).json({
        success: true,
        data: { comment },
      });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const postId = req.params.postId as string;
      const callerId = req.user?.id;

      const comments = await this.commentService.listCommentsByPost(postId, callerId);

      res.status(200).json({
        success: true,
        data: { comments },
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const commentId = req.params.commentId as string;
      const input = req.body as UpdateCommentInput;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const comment = await this.commentService.updateComment(commentId, input, userId, userRole);

      res.status(200).json({
        success: true,
        data: { comment },
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const commentId = req.params.commentId as string;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      await this.commentService.deleteComment(commentId, userId, userRole);

      res.status(200).json({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const commentId = req.params.commentId as string;
      const userId = req.user!.id;

      const result = await this.commentService.toggleCommentLike(commentId, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
