import type { Request, Response, NextFunction } from 'express';
import { jwtService } from '../common/security/jwt.service.js';
import { UnauthorizedError, ForbiddenError } from '../common/errors/app-error.js';
import type { Role } from '@prisma/client';

/**
 * TypeScript Declaration Merging
 *
 * WHY:
 * In Express, `req` does not have a `user` property by default.
 * By merging into `Express.Request` in the global namespace,
 * TypeScript provides static auto-completion and compile-time type safety
 * for `req.user` across all controllers and route handlers.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
      };
    }
  }
}

/**
 * Authenticate Middleware
 *
 * 1. Checks for 'Authorization: Bearer <token>' header.
 * 2. Verifies cryptographic signature and expiration via JwtService.
 * 3. Injects decoded claims into `req.user`.
 */
import { tokenBlacklistService } from '../common/security/token-blacklist.service.js';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token required');
    }

    const token = authHeader.split(' ')[1];
    const payload = jwtService.verifyAccessToken(token);

    // ⚡ Instant Revocation Check (<0.5ms in Redis RAM):
    const isRevoked = await tokenBlacklistService.isBlacklisted(token);
    if (isRevoked) {
      throw new UnauthorizedError('Token has been revoked. Please log in again.');
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Restricts endpoint execution to specific User roles (e.g. 'ADMIN', 'CLUB_LEADER').
 * Throws 403 Forbidden if the user lacks the required role.
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    next();
  };
};
