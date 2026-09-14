import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { resetDatabase, resetRedis, createTestUser } from '../helpers/test-helpers.js';
import { tokenBlacklistService } from '../../src/common/security/token-blacklist.service.js';

describe('Security: Auth Tampering, Forgery & Expiration Tests', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
    await resetRedis();
  });

  afterAll(async () => {
    await resetDatabase();
    await resetRedis();
  });

  it('should reject a forged JWT signed with an untrusted secret key', async () => {
    const forgedToken = jwt.sign(
      {
        userId: 'attacker-uuid',
        email: 'attacker@evil.com',
        role: 'ADMIN', // Attacker trying to escalate privilege to ADMIN!
      },
      'attacker_fake_private_secret_key_123',
      { expiresIn: '1h' },
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forgedToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject an expired JWT access token', async () => {
    const expiredToken = jwt.sign(
      {
        userId: 'user-uuid',
        email: 'expired@stanford.edu',
        role: 'STUDENT',
      },
      process.env.JWT_ACCESS_SECRET || 'development_secret_key_for_access_token_min_32_chars',
      { expiresIn: '-10s' }, // Expired 10 seconds ago
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject a token that has been cryptographically tampered with', async () => {
    const { accessToken } = await createTestUser();

    // Tamper with the cryptographic signature (corrupt the last 4 characters)
    const tamperedToken = accessToken.slice(0, -4) + 'zzzz';

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should immediately reject a token blacklisted in Redis', async () => {
    const { accessToken } = await createTestUser();

    // 1. Verify token works initially
    const validRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(validRes.status).toBe(200);

    // 2. Blacklist token in Redis
    await tokenBlacklistService.blacklistToken(accessToken);

    // 3. Verify immediate rejection
    const blacklistedRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(blacklistedRes.status).toBe(401);
    expect(blacklistedRes.body.error.message).toMatch(/revoked/i);
  });
});
