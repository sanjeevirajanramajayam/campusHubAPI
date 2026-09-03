import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate, requireRole } from '../../src/middleware/auth.middleware.js';
import { jwtService } from '../../src/common/security/jwt.service.js';
import { tokenBlacklistService } from '../../src/common/security/token-blacklist.service.js';
import { UnauthorizedError, ForbiddenError } from '../../src/common/errors/app-error.js';
import type { Request, Response, NextFunction } from 'express';

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should throw UnauthorizedError if Authorization header is missing', async () => {
      const req = { headers: {} } as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should throw UnauthorizedError if token is blacklisted in Redis', async () => {
      const req = {
        headers: { authorization: 'Bearer blacklisted-token-123' },
      } as Request;
      const next = vi.fn();
      const res = {} as Response;

      vi.spyOn(jwtService, 'verifyAccessToken').mockReturnValue({
        userId: 'user-1',
        email: 'alex@stanford.edu',
        role: 'STUDENT',
      });
      vi.spyOn(tokenBlacklistService, 'isBlacklisted').mockResolvedValue(true);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = next.mock.calls[0][0] as UnauthorizedError;
      expect(error.message).toContain('revoked');
    });

    it('should populate req.user and call next() on valid token', async () => {
      const req = {
        headers: { authorization: 'Bearer valid-token-123' },
      } as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      vi.spyOn(jwtService, 'verifyAccessToken').mockReturnValue({
        userId: 'user-1',
        email: 'alex@stanford.edu',
        role: 'STUDENT',
      });
      vi.spyOn(tokenBlacklistService, 'isBlacklisted').mockResolvedValue(false);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(); // called without error
      expect(req.user).toEqual({
        id: 'user-1',
        email: 'alex@stanford.edu',
        role: 'STUDENT',
      });
    });
  });

  describe('requireRole', () => {
    it('should call next() when user has one of the allowed roles', () => {
      const middleware = requireRole('ADMIN', 'CLUB_ADMIN');

      const req = {
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' },
      } as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should throw ForbiddenError (403) when user lacks required role', () => {
      const middleware = requireRole('ADMIN');

      const req = {
        user: { id: 'u1', email: 'a@a.com', role: 'STUDENT' },
      } as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      expect(() => middleware(req, res, next)).toThrow(ForbiddenError);
    });

    it('should throw UnauthorizedError if req.user is undefined', () => {
      const middleware = requireRole('ADMIN');

      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      expect(() => middleware(req, res, next)).toThrow(UnauthorizedError);
    });
  });
});
