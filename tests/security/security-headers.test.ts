import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('Security Headers & DoS Protection Tests', () => {
  const app = createApp();

  it('should include Helmet security headers on HTTP responses', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);

    // X-Content-Type-Options prevents MIME-sniffing
    expect(response.headers['x-content-type-options']).toBe('nosniff');

    // X-Frame-Options prevents clickjacking attacks
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');

    // X-DNS-Prefetch-Control protects against DNS prefetch leaks
    expect(response.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('should reject payloads exceeding the 1MB body limit with 413 Payload Too Large', async () => {
    // Generate a payload slightly larger than 1MB (1.1 MB string)
    const largeString = 'A'.repeat(1.1 * 1024 * 1024);

    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: largeString }));

    // express.json({ limit: '1mb' }) rejects oversized payloads
    expect(response.status).toBe(413);
  });

  it('should correctly configure CORS headers for allowed origins', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
