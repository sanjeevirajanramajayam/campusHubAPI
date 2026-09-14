import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDatabase, resetRedis, createTestUser } from '../helpers/test-helpers.js';
import { prisma } from '../../src/infrastructure/prisma/client.js';

describe('Concurrency & Race Conditions: Idempotency Lock', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
    await resetRedis();
  });

  afterAll(async () => {
    await resetDatabase();
    await resetRedis();
  });

  it('should prevent race condition duplicates when multiple identical requests arrive simultaneously', async () => {
    const { accessToken } = await createTestUser();
    const idempotencyKey = 'race-condition-key-777';

    const payload = {
      name: 'Stanford Quantum Computing Lab',
      description: 'Superconducting qubits and quantum error correction architectures.',
    };

    // Fire 5 identical requests simultaneously over HTTP
    const requests = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload),
    );

    const responses = await Promise.all(requests);

    // Verify all responses have standard HTTP status codes (201 Created or 409 Conflict)
    const statusCodes = responses.map((res) => res.status);
    expect(statusCodes.every((code) => code === 201 || code === 409 || code === 422)).toBe(true);

    // At least one request succeeded with 201 Created
    const successfulResponses = responses.filter((res) => res.status === 201);
    expect(successfulResponses.length).toBeGreaterThanOrEqual(1);

    // CRITICAL: Database integrity check - Exactly ONE club was persisted
    const clubsInDb = await prisma.club.findMany({
      where: { name: 'Stanford Quantum Computing Lab' },
    });
    expect(clubsInDb.length).toBe(1);
  });
});
