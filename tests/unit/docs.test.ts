import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { swaggerSpec } from '../../src/infrastructure/docs/swagger.config.js';

// Mock redis to avoid open socket connections during unit testing
vi.mock('../../src/infrastructure/redis/client.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('Automated API Documentation Suite (OpenAPI 3.0 & Swagger UI)', () => {
  const app = createApp();

  describe('OpenAPI 3.0 Specification Integrity', () => {
    it('should have valid OpenAPI 3.0.3 root structure and metadata', () => {
      expect(swaggerSpec.openapi).toBe('3.0.3');
      expect(swaggerSpec.info.title).toBe('CampusHub Enterprise API');
      expect(swaggerSpec.info.version).toBe('1.0.0');
      expect(swaggerSpec.servers.length).toBeGreaterThan(0);
    });

    it('should register expected feature tags', () => {
      const tagNames = swaggerSpec.tags.map((t) => t.name);
      expect(tagNames).toContain('Auth');
      expect(tagNames).toContain('Clubs');
      expect(tagNames).toContain('Events');
      expect(tagNames).toContain('System');
    });

    it('should configure Bearer JWT and Cookie security schemes', () => {
      expect(swaggerSpec.components.securitySchemes.bearerAuth).toBeDefined();
      expect(swaggerSpec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
      expect(swaggerSpec.components.securitySchemes.cookieAuth).toBeDefined();
      expect(swaggerSpec.components.securitySchemes.cookieAuth.in).toBe('cookie');
    });

    it('should document RFC 9440 Idempotency-Key parameter', () => {
      expect(swaggerSpec.components.parameters.IdempotencyKeyHeader).toBeDefined();
      expect(swaggerSpec.components.parameters.IdempotencyKeyHeader.name).toBe('Idempotency-Key');
    });

    it('should document critical DTO schemas', () => {
      const { schemas } = swaggerSpec.components;
      expect(schemas.RegisterRequest).toBeDefined();
      expect(schemas.LoginRequest).toBeDefined();
      expect(schemas.CreateClubRequest).toBeDefined();
      expect(schemas.CreateEventRequest).toBeDefined();
      expect(schemas.ErrorResponse).toBeDefined();
    });

    it('should expose paths for core REST resources', () => {
      const { paths } = swaggerSpec;
      expect(paths['/health']).toBeDefined();
      expect(paths['/auth/register']).toBeDefined();
      expect(paths['/auth/login']).toBeDefined();
      expect(paths['/clubs']).toBeDefined();
      expect(paths['/events']).toBeDefined();
      expect(paths['/events/{id}/tickets']).toBeDefined();
    });
  });

  describe('HTTP Documentation Endpoints', () => {
    it('should serve machine-readable OpenAPI specification at GET /docs/openapi.json', async () => {
      const response = await request(app).get('/docs/openapi.json');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body.openapi).toBe('3.0.3');
      expect(response.body.info.title).toBe('CampusHub Enterprise API');
    });

    it('should serve interactive Swagger UI HTML at GET /docs/', async () => {
      const response = await request(app).get('/docs/');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('swagger-ui');
    });
  });
});
