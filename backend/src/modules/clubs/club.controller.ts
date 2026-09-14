import type { Request, Response, NextFunction } from 'express';
import type { ClubService } from './club.service.js';
import type { CreateClubInput } from './club.dto.js';

export class ClubController {
  constructor(private readonly clubService: ClubService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateClubInput;
      const creatorId = req.user!.id;

      const club = await this.clubService.createClub(creatorId, input);

      res.status(201).json({
        success: true,
        data: { club },
      });
    } catch (err) {
      next(err);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const clubs = await this.clubService.getAllClubs(limit, offset);

      res.status(200).json({
        success: true,
        data: { clubs },
      });
    } catch (err) {
      next(err);
    }
  };

  getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = req.params.slug as string;
      const club = await this.clubService.getClubBySlug(slug);

      res.status(200).json({
        success: true,
        data: { club },
      });
    } catch (err) {
      next(err);
    }
  };

  join = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clubId = req.params.id as string;
      const userId = req.user!.id;

      const membership = await this.clubService.joinClub(clubId, userId);

      res.status(201).json({
        success: true,
        data: { membership },
      });
    } catch (err) {
      next(err);
    }
  };

  leave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clubId = req.params.id as string;
      const userId = req.user!.id;

      await this.clubService.leaveClub(clubId, userId);

      res.status(200).json({
        success: true,
        message: 'Successfully left the club',
      });
    } catch (err) {
      next(err);
    }
  };
}
