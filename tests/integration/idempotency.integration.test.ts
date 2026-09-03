import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDatabase, resetRedis, createTestUser } from '../helpers/test-helpers.js';
import { redis } from '../../src/infrastructure/redis/client.js';

describe('Idempotency Integration Tests (RFC 9440 & Supertest)', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
    await resetRedis();
  });

  afterAll(async () => {
    await resetDatabase();
    await resetRedis();
  });

  it('should process first request as MISS and replay second identical request as HIT', async () => {
    const { accessToken } = await createTestUser();
    const idempotencyKey = 'idem-test-key-001';

    const payload = {
      name: 'Stanford Formula Racing',
      description: 'Formula SAE electric racecar engineering and design team.',
    };

    // 1. Initial Request (MISS)
    const firstRes = await request(app)
      .post('/api/v1/clubs')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.headers['x-cache-lookup']).toBeUndefined();
    expect(firstRes.body.data.club.slug).toBe('stanford-formula-racing');

    // Verify record exists in Redis
    const redisRecord = await redis.get(`idemp:${idempotencyKey}`);
    expect(redisRecord).not.toBeNull();
    const parsedRecord = JSON.parse(redisRecord!);
    expect(parsedRecord.status).toBe('COMPLETED');
    expect(parsedRecord.statusCode).toBe(201);

    // 2. Replayed Request with exact same key and body (HIT)
    const replayRes = await request(app)
      .post('/api/v1/clubs')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(replayRes.status).toBe(201);
    expect(replayRes.headers['x-cache-lookup']).toBe('HIT - Idempotent Replay');
    expect(replayRes.body).toEqual(firstRes.body);
  });

  it('should return 422 Unprocessable Entity when idempotency key is reused with a tampered body', async () => {
    const { accessToken } = await createTestUser();
    const idempotencyKey = 'idem-tamper-key-002';

    // 1. Legitimate original request
    const originalRes = await request(app)
      .post('/api/v1/clubs')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        name: 'Original Club Name',
        description: 'Original description of the student organisation.',
      });

    expect(originalRes.status).toBe(201);

    // 2. Tampered request: Reusing same Idempotency-Key with DIFFERENT payload
    const tamperedRes = await request(app)
      .post('/api/v1/clubs')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        name: 'Tampered Club Name',
        description: 'Tampered description attempting key hijacking.',
      });

    expect(tamperedRes.status).toBe(422);
    expect(tamperedRes.body.success).toBe(false);
    expect(tamperedRes.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('should bypass idempotency check for GET requests even if header is provided', async () => {
    const response = await request(app)
      .get('/api/v1/clubs')
      .set('Idempotency-Key', 'get-request-key-999');

    expect(response.status).toBe(200);
    expect(response.headers['x-cache-lookup']).toBeUndefined();

    // Verify key was NOT written to Redis
    const record = await redis.get('idemp:get-request-key-999');
    expect(record).toBeNull();
  });
});
