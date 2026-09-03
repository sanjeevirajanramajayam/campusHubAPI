import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDatabase, resetRedis } from '../helpers/test-helpers.js';
import { prisma } from '../../src/infrastructure/prisma/client.js';

describe('Concurrency & Security: Refresh Token Family Revocation', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
    await resetRedis();
  });

  afterAll(async () => {
    await resetDatabase();
    await resetRedis();
  });

  it('should detect token reuse and revoke the entire token family', async () => {
    // 1. User registers and receives Token T1
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'theft.detection@stanford.edu',
      password: 'StrongPassword123!',
      firstName: 'Theft',
      lastName: 'Detection',
    });

    const cookieT1 = regRes.headers['set-cookie'];

    // 2. Legitimate rotation: Use T1 to obtain T2 (T1 is now marked as used!)
    const rotationRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieT1);

    expect(rotationRes.status).toBe(200);
    const cookieT2 = rotationRes.headers['set-cookie'];

    // 3. Attacker steals already-used T1 and attempts concurrent reuse
    const concurrentAttacks = [
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookieT1),
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookieT1),
    ];

    const attackResponses = await Promise.all(concurrentAttacks);

    // Both attack attempts must be rejected with 401
    expect(attackResponses.every((res) => res.status === 401)).toBe(true);

    // 4. NUCLEAR REVOCATION VERIFICATION:
    // Because reuse was detected, the entire token family was revoked.
    // Even the legitimate user with Token T2 can NO LONGER refresh!
    const legitUserWithT2Res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieT2);

    expect(legitUserWithT2Res.status).toBe(401);
    expect(legitUserWithT2Res.body.error.code).toBe('UNAUTHORIZED');

    const userId = regRes.body.data.user.id;
    const tokensInDb = await prisma.refreshToken.findMany({
      where: { userId },
    });
    expect(tokensInDb.length).toBe(0);
  });
});
