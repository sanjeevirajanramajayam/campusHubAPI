import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import type { IUserRepository } from '../../src/modules/users/user.repository.interface.js';
import type { IRefreshTokenRepository } from '../../src/modules/auth/refresh-token.repository.interface.js';
import { PasswordService } from '../../src/common/security/password.service.js';
import { JwtService } from '../../src/common/security/jwt.service.js';
import { ConflictError, UnauthorizedError } from '../../src/common/errors/app-error.js';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: IUserRepository;
  let mockTokenRepo: IRefreshTokenRepository;
  let mockPasswordService: PasswordService;
  let mockJwtService: JwtService;

  const mockUser = {
    id: 'user-uuid-1',
    name: 'Alex Chen',
    email: 'alex@stanford.edu',
    passwordHash: '$argon2id$hashedpassword',
    role: 'STUDENT' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepo = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
    };

    mockTokenRepo = {
      create: vi.fn(),
      findByTokenHash: vi.fn(),
      markAsUsed: vi.fn(),
      update: vi.fn(),
      revokeFamily: vi.fn(),
      deleteByTokenHash: vi.fn(),
    };

    mockPasswordService = {
      hash: vi.fn().mockResolvedValue('$argon2id$hashedpassword'),
      verify: vi.fn(),
    } as any;

    mockJwtService = {
      generateAccessToken: vi.fn().mockReturnValue('mock.access.token'),
      generateRefreshToken: vi.fn().mockReturnValue('mock.refresh.token'),
      verifyRefreshToken: vi.fn().mockReturnValue({ userId: 'user-uuid-1' }),
      verifyAccessToken: vi.fn(),
    } as any;

    authService = new AuthService(
      mockUserRepo,
      mockTokenRepo,
      mockPasswordService,
      mockJwtService,
    );
  });

  describe('register', () => {
    it('should throw ConflictError if user with email already exists', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(mockUser);

      await expect(
        authService.register({
          name: 'Alex Chen',
          email: 'alex@stanford.edu',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictError);

      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });

    it('should hash password and create user with tokens', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepo.create).mockResolvedValue(mockUser);

      const result = await authService.register({
        name: 'Alex Chen',
        email: 'alex@stanford.edu',
        password: 'Password123!',
      });

      expect(mockPasswordService.hash).toHaveBeenCalledWith('Password123!');
      expect(result.user.email).toBe('alex@stanford.edu');
      expect(result.tokens.accessToken).toBe('mock.access.token');
      expect(result.tokens.refreshToken).toBe('mock.refresh.token');
      expect(mockTokenRepo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedError if user does not exist', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@stanford.edu',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if password is wrong', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(mockPasswordService.verify).mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'alex@stanford.edu',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should generate tokens and store refresh token on successful login', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(mockPasswordService.verify).mockResolvedValue(true);

      const result = await authService.login({
        email: 'alex@stanford.edu',
        password: 'Password123!',
      });

      expect(result.user.id).toBe(mockUser.id);
      expect(result.tokens.accessToken).toBe('mock.access.token');
      expect(result.tokens.refreshToken).toBe('mock.refresh.token');
      expect(mockTokenRepo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh & theft detection', () => {
    it('should revoke entire token family and throw UnauthorizedError if token was ALREADY USED (Theft!)', async () => {
      vi.mocked(mockTokenRepo.findByTokenHash).mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash-1',
        userId: 'user-uuid-1',
        familyId: 'family-abc',
        isUsed: true, // 🚨 ALREADY USED!
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
      });

      await expect(authService.refresh('mock.used.token')).rejects.toThrow(UnauthorizedError);
      // Confirms atomic family revocation triggered!
      expect(mockTokenRepo.revokeFamily).toHaveBeenCalledWith('family-abc');
    });

    it('should mark token used and generate new token pair on valid refresh', async () => {
      vi.mocked(mockTokenRepo.findByTokenHash).mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash-1',
        userId: 'user-uuid-1',
        familyId: 'family-abc',
        isUsed: false,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
      });
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);

      const result = await authService.refresh('mock.fresh.token');

      expect(mockTokenRepo.markAsUsed).toHaveBeenCalledWith('token-1');
      expect(result.tokens.accessToken).toBe('mock.access.token');
      expect(result.tokens.refreshToken).toBe('mock.refresh.token');
      expect(mockTokenRepo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    it('should delete or revoke refresh token record', async () => {
      await authService.logout('mock.logout.token');
      expect(mockTokenRepo.deleteByTokenHash).toHaveBeenCalledTimes(1);
    });
  });
});
