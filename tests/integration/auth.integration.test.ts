import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDatabase, resetRedis } from '../helpers/test-helpers.js';
import { prisma } from '../../src/infrastructure/prisma/client.js';
import { redis } from '../../src/infrastructure/redis/client.js';

describe('Auth Integration Tests (Supertest)', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
    await resetRedis();
  });

  afterAll(async () => {
    await resetDatabase();
    await resetRedis();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user, return 201, and set the refreshToken cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'alex@stanford.edu',
          password: 'SecurePassword123!',
          firstName: 'Alex',
          lastName: 'Chen',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('alex@stanford.edu');
      expect(response.body.data.accessToken).toBeDefined();

      // Ensure password hash is NEVER leaked in response
      expect(response.body.data.user.passwordHash).toBeUndefined();

      // Verify HttpOnly cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refreshToken=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
    });

    it('should return 409 Conflict when registering with duplicate email', async () => {
      // 1. First registration
      await request(app).post('/api/v1/auth/register').send({
        email: 'alex@stanford.edu',
        password: 'SecurePassword123!',
        firstName: 'Alex',
        lastName: 'Chen',
      });

      // 2. Duplicate registration
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'alex@stanford.edu',
        password: 'AnotherPassword123!',
        firstName: 'Alex',
        lastName: 'Duplicate',
      });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should return 422 Unprocessable Entity when password is under 8 characters', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'short@stanford.edu',
        password: 'short',
        firstName: 'Short',
        lastName: 'Pass',
      });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login an existing user and return 200 with JWT', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'login.user@stanford.edu',
        password: 'CorrectPassword123!',
        firstName: 'Login',
        lastName: 'User',
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'login.user@stanford.edu',
        password: 'CorrectPassword123!',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe('login.user@stanford.edu');
    });

    it('should return 401 Unauthorized with invalid password', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'wrongpass@stanford.edu',
        password: 'CorrectPassword123!',
        firstName: 'Wrong',
        lastName: 'Pass',
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'wrongpass@stanford.edu',
        password: 'WrongPassword999!',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return the current user profile when valid Bearer token is provided', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send({
        email: 'profile.user@stanford.edu',
        password: 'ValidPassword123!',
        firstName: 'Profile',
        lastName: 'Tester',
      });

      const token = reg.body.data.accessToken;

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('profile.user@stanford.edu');
      expect(response.body.data.user.firstName).toBe('Profile');
    });

    it('should return 401 Unauthorized if Authorization header is missing', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/refresh and POST /api/v1/auth/logout', () => {
    it('should rotate refresh token and blacklist access token on logout', async () => {
      // 1. Register
      const reg = await request(app).post('/api/v1/auth/register').send({
        email: 'session.test@stanford.edu',
        password: 'Password12345!',
        firstName: 'Session',
        lastName: 'Test',
      });

      const initialAccessToken = reg.body.data.accessToken;
      const initialCookie = reg.headers['set-cookie'];

      // 2. Refresh Token
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialCookie);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.accessToken).toBeDefined();

      const newAccessToken = refreshRes.body.data.accessToken;
      const newCookie = refreshRes.headers['set-cookie'];

      // 3. Logout with the new access token and cookie
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .set('Cookie', newCookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe('Logged out successfully');

      // 4. Verify that the blacklisted accessToken is rejected on /me
      const meAfterLogout = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(meAfterLogout.status).toBe(401);
      expect(meAfterLogout.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
