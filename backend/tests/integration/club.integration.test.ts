import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDatabase, resetRedis, createTestUser } from '../helpers/test-helpers.js';

describe('Club Integration Tests (Supertest)', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
    await resetRedis();
  });

  afterAll(async () => {
    await resetDatabase();
    await resetRedis();
  });

  describe('POST /api/v1/clubs', () => {
    it('should create a club and assign the creator as ADMIN', async () => {
      const { accessToken } = await createTestUser();

      const response = await request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Stanford Robotics Society',
          description: 'Autonomous systems, robotics competitions, and computer vision.',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.club.name).toBe('Stanford Robotics Society');
      expect(response.body.data.club.slug).toBe('stanford-robotics-society');
      expect(response.body.data.club.id).toBeDefined();
    });

    it('should return 409 Conflict when creating a club with an existing name', async () => {
      const { accessToken } = await createTestUser();

      // 1. First creation
      await request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Stanford Robotics Society',
          description: 'Autonomous systems, robotics competitions, and computer vision.',
        });

      // 2. Duplicate creation
      const response = await request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Stanford Robotics Society',
          description: 'Another duplicate robotics club description.',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should return 401 Unauthorized when no auth token is provided', async () => {
      const response = await request(app).post('/api/v1/clubs').send({
        name: 'Unauthorized Club',
        description: 'Should fail authentication check.',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/clubs and GET /api/v1/clubs/:slug', () => {
    it('should list all clubs publicly', async () => {
      const { accessToken } = await createTestUser();

      await request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Stanford AI Society',
          description: 'Machine learning and deep neural networks research group.',
        });

      const response = await request(app).get('/api/v1/clubs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.clubs)).toBe(true);
      expect(response.body.data.clubs.length).toBeGreaterThanOrEqual(1);
    });

    it('should retrieve a club by its slug', async () => {
      const { accessToken } = await createTestUser();

      await request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Stanford Blockchain Club',
          description: 'Smart contracts, zero-knowledge proofs, and web3 systems.',
        });

      const response = await request(app).get('/api/v1/clubs/stanford-blockchain-club');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.club.slug).toBe('stanford-blockchain-club');
    });

    it('should return 404 Not Found for non-existent club slug', async () => {
      const response = await request(app).get('/api/v1/clubs/non-existent-club-slug');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/clubs/:id/join and DELETE /api/v1/clubs/:id/leave', () => {
    it('should allow another user to join and leave the club', async () => {
      // 1. Creator creates club
      const creator = await createTestUser();
      const clubRes = await request(app)
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${creator.accessToken}`)
        .send({
          name: 'Stanford Debate Society',
          description: 'Parliamentary debate, public speaking, and tournaments.',
        });
      const clubId = clubRes.body.data.club.id;

      // 2. Member joins club
      const member = await createTestUser();
      const joinRes = await request(app)
        .post(`/api/v1/clubs/${clubId}/join`)
        .set('Authorization', `Bearer ${member.accessToken}`);

      expect(joinRes.status).toBe(201);
      expect(joinRes.body.success).toBe(true);
      expect(joinRes.body.data.membership.role).toBe('MEMBER');

      // 3. Member leaves club
      const leaveRes = await request(app)
        .delete(`/api/v1/clubs/${clubId}/leave`)
        .set('Authorization', `Bearer ${member.accessToken}`);

      expect(leaveRes.status).toBe(200);
      expect(leaveRes.body.message).toBe('Successfully left the club');
    });
  });
});
