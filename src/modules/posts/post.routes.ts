import { Router } from 'express';
import { PostController } from './post.controller.js';
import { CommentController } from './comment.controller.js';
import { PostService } from './post.service.js';
import { CommentService } from './comment.service.js';
import { PrismaPostRepository } from './post.repository.js';
import { PrismaCommentRepository } from './comment.repository.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  postQuerySchema,
} from './post.dto.js';

export const createPostRouter = (): Router => {
  const router = Router();

  const postRepo = new PrismaPostRepository();
  const commentRepo = new PrismaCommentRepository();

  const postService = new PostService(postRepo);
  const commentService = new CommentService(commentRepo, postRepo);

  const postController = new PostController(postService);
  const commentController = new CommentController(commentService);

  // --- Post Routes ---
  router.get('/', validate(postQuerySchema, 'query'), postController.list);
  router.get('/:id', postController.getById);
  router.post('/', authenticate, validate(createPostSchema), postController.create);
  router.patch('/:id', authenticate, validate(updatePostSchema), postController.update);
  router.delete('/:id', authenticate, postController.delete);
  router.post('/:id/like', authenticate, postController.toggleLike);

  // --- Threaded Comment Routes ---
  router.get('/:postId/comments', commentController.list);
  router.post(
    '/:postId/comments',
    authenticate,
    validate(createCommentSchema),
    commentController.create,
  );
  router.patch(
    '/:postId/comments/:commentId',
    authenticate,
    validate(updateCommentSchema),
    commentController.update,
  );
  router.delete('/:postId/comments/:commentId', authenticate, commentController.delete);
  router.post('/:postId/comments/:commentId/like', authenticate, commentController.toggleLike);

  return router;
};
