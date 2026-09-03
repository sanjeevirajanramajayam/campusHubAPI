import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from './auth.service.js';
import type { RegisterInput, LoginInput } from './auth.dto.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';
import { env } from '../../config/env.js';

/**
 * Authentication HTTP Controller
 * 
 * WHY:
 * 1. Handles HTTP concerns: extracting body, setting status codes, managing cookie headers.
 * 2. Completely delegates business workflows to the injected AuthService.
 * 3. Enforces HttpOnly, SameSite=Strict cookie security for refresh tokens.
 */
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,                        // Blocks JavaScript XSS access
      secure: env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',                   // Prevents CSRF attacks
      maxAge: 7 * 24 * 60 * 60 * 1000,      // 7 days in milliseconds
      path: `${env.API_PREFIX}/auth`,       // Scoped only to auth endpoints
    });
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as RegisterInput;
      const result = await this.authService.register(input);

      this.setRefreshTokenCookie(res, result.tokens.refreshToken);

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as LoginInput;
      const result = await this.authService.login(input);

      this.setRefreshTokenCookie(res, result.tokens.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.authService.getProfile(req.user!.id);

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken = req.cookies.refreshToken as string | undefined;

      if (!rawRefreshToken) {
        throw new UnauthorizedError('Refresh token required');
      }

      const result = await this.authService.refresh(rawRefreshToken);

      this.setRefreshTokenCookie(res, result.tokens.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken = req.cookies.refreshToken as string | undefined;

      if (rawRefreshToken) {
        await this.authService.logout(rawRefreshToken);
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: `${env.API_PREFIX}/auth`,
      });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  };
}
