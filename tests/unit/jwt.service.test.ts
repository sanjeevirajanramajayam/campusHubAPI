import { describe, it, expect } from 'vitest';
import { JwtService } from '../../src/common/security/jwt.service.js';
import { UnauthorizedError } from '../../src/common/errors/app-error.js';

describe('JwtService', () => {
  const jwtService = new JwtService();

  const mockPayload = {
    userId: 'user-uuid-1234',
    email: 'student@stanford.edu',
    role: 'STUDENT' as const,
  };

  it('should generate and verify a valid access token', () => {
    const token = jwtService.generateAccessToken(mockPayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = jwtService.verifyAccessToken(token);
    expect(decoded.userId).toBe(mockPayload.userId);
    expect(decoded.email).toBe(mockPayload.email);
    expect(decoded.role).toBe(mockPayload.role);
  });

  it('should generate a refresh token with unique jti', () => {
    const token1 = jwtService.generateRefreshToken({ userId: mockPayload.userId });
    const token2 = jwtService.generateRefreshToken({ userId: mockPayload.userId });

    expect(token1).toBeDefined();
    expect(token2).toBeDefined();
    // Unique jwtid guarantees hashes never collide even in the same second
    expect(token1).not.toBe(token2);

    const decoded = jwtService.verifyRefreshToken(token1);
    expect(decoded.userId).toBe(mockPayload.userId);
  });

  it('should throw UnauthorizedError when verifying a tampered token', () => {
    const validToken = jwtService.generateAccessToken(mockPayload);
    const tamperedToken = `${validToken}malicious`;

    expect(() => jwtService.verifyAccessToken(tamperedToken)).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when verifying an invalid format string', () => {
    expect(() => jwtService.verifyAccessToken('invalid.token.here')).toThrow(UnauthorizedError);
  });
});
