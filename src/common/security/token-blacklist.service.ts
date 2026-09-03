import jwt from 'jsonwebtoken';
import { redis } from '../../infrastructure/redis/client.js';
import { createHash } from 'crypto';

/**
 * Token Blacklist Service (Redis In-Memory Revocation)
 *
 * WHY:
 * 1. Solves the Stateless JWT Dilemma: Allows instant revocation upon logout.
 * 2. Uses SHA-256 token hashing for compact Redis keys.
 * 3. Sets an exact TTL matching the token's remaining lifespan, ensuring zero memory leaks
 *    as Redis automatically evicts expired keys.
 */
export class TokenBlacklistService {
  private getBlacklistKey(token: string): string {
    const hash = createHash('sha256').update(token).digest('hex');
    return `bl:${hash}`;
  }

  /**
   * Blacklists an Access Token in Redis for its remaining lifespan
   */
  async blacklistToken(token: string): Promise<void> {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded || !decoded.exp) {
      return;
    }

    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = decoded.exp - currentTimeInSeconds;

    if (ttlSeconds <= 0) {
      return;
    }

    const key = this.getBlacklistKey(token);
    await redis.set(key, 'revoked', 'EX', ttlSeconds);
  }

  /**
   * Checks if an Access Token has been explicitly revoked
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const key = this.getBlacklistKey(token);
    const result = await redis.exists(key);
    return result === 1;
  }
}

export const tokenBlacklistService = new TokenBlacklistService();
