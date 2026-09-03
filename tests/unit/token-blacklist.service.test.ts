import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenBlacklistService } from '../../src/common/security/token-blacklist.service.js';
import { redis } from '../../src/infrastructure/redis/client.js';
import jwt from 'jsonwebtoken';

vi.mock('../../src/infrastructure/redis/client.js', () => ({
  redis: {
    set: vi.fn(),
    exists: vi.fn(),
  },
}));

describe('TokenBlacklistService', () => {
  let blacklistService: TokenBlacklistService;

  beforeEach(() => {
    vi.clearAllMocks();
    blacklistService = new TokenBlacklistService();
  });

  it('should calculate remaining TTL and store SHA-256 hashed token in Redis', async () => {
    // Generate a valid JWT expiring in 10 minutes (600 seconds)
    const futureExp = Math.floor(Date.now() / 1000) + 600;
    const token = jwt.sign({ userId: 'user-123', exp: futureExp }, 'test-secret');

    await blacklistService.blacklistToken(token);

    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value, mode, ttl] = vi.mocked(redis.set).mock.calls[0] as unknown as [
      string,
      string,
      string,
      number,
    ];

    expect(key).toMatch(/^bl:[a-f0-9]{64}$/); // SHA-256 hash prefix
    expect(value).toBe('revoked');
    expect(mode).toBe('EX');
    expect(ttl).toBeGreaterThan(590); // ~600 seconds
    expect(ttl).toBeLessThanOrEqual(600);
  });

  it('should skip blacklisting if token is already expired', async () => {
    // Generate an already-expired token
    const pastExp = Math.floor(Date.now() / 1000) - 100;
    const expiredToken = jwt.sign({ userId: 'user-123', exp: pastExp }, 'test-secret');

    await blacklistService.blacklistToken(expiredToken);

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('should skip blacklisting if token string is invalid', async () => {
    await blacklistService.blacklistToken('not-a-jwt');
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('should return true if token exists in Redis blacklist', async () => {
    vi.mocked(redis.exists).mockResolvedValue(1);

    const isRevoked = await blacklistService.isBlacklisted('some-valid-token');
    expect(isRevoked).toBe(true);
    expect(redis.exists).toHaveBeenCalledWith(expect.stringMatching(/^bl:[a-f0-9]{64}$/));
  });

  it('should return false if token is not in Redis blacklist', async () => {
    vi.mocked(redis.exists).mockResolvedValue(0);

    const isRevoked = await blacklistService.isBlacklisted('clean-token');
    expect(isRevoked).toBe(false);
  });
});
