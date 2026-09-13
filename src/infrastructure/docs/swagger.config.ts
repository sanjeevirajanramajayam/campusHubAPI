import type { SwaggerUiOptions } from 'swagger-ui-express';

/**
 * CampusHub Enterprise OpenAPI 3.0.3 Specification
 *
 * Provides a contract-first, comprehensive documentation suite detailing:
 * - RFC 9440 Distributed Idempotency Key headers
 * - Dual-layer JWT Authentication (Bearer Access Tokens & HTTP-Only Refresh Cookies)
 * - Strict Argon2id password validation rules
 * - Club Membership RBAC (LEAD, MODERATOR, MEMBER)
 * - Concurrency-safe event ticket purchases with PostgreSQL row locking
 */
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CampusHub Enterprise API',
    version: '1.0.0',
    description: `
# CampusHub Enterprise Backend API 🎓🚀

Welcome to the official interactive API documentation for **CampusHub**.

### Core Architectural Features:
* **Authentication**: RFC 9106 Argon2id password hashing, Stateless JWT access tokens with Redis Token Family tracking and rotation.
* **Idempotency Guard**: RFC 9440 compliant distributed idempotency with Redis caching to prevent double-billing and duplicate ticket bookings.
* **Concurrency Protection**: High-throughput ticket reservation engine backed by PostgreSQL \`SELECT ... FOR UPDATE\` pessimistic row locks.
* **Rate Limiting & Security**: Strict Helmet CSP headers, CORS isolation, and centralized RFC 7807 problem details error handling.
    `,
    contact: {
      name: 'CampusHub Engineering Team',
      url: 'https://github.com/sanjeevirajanramajayam/campusHubAPI',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current API Gateway (Relative)',
    },
    {
      url: 'http://localhost:5000/api/v1',
      description: 'Local Development Server',
    },
    {
      url: 'https://campushub-api.onrender.com/api/v1',
      description: 'Production Cloud Server (Render)',
    },
  ],
  tags: [
    {
      name: 'Auth',
      description: 'Authentication, registration, JWT session issuance, and token refresh rotation',
    },
    {
      name: 'Clubs',
      description: 'Campus student organizations, leadership roles, and membership management',
    },
    {
      name: 'Events',
      description: 'Campus events, scheduling, and concurrency-safe seat ticketing',
    },
    {
      name: 'Posts',
      description: 'Community forum feed, topic tagging, upvoting, and threaded discussions',
    },
    {
      name: 'System',
      description: 'Operational health probes and uptime metrics',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT Access Token (issued upon /auth/login or /auth/register).',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'HTTP-Only refresh token stored in secure browser cookie.',
      },
    },
    parameters: {
      IdempotencyKeyHeader: {
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        schema: {
          type: 'string',
          format: 'uuid',
          example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        },
        description:
          'RFC 9440 Idempotency Key. Guarantees safe retries without duplicate side-effects (e.g. preventing double-booking).',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'BAD_REQUEST' },
          message: { type: 'string', example: 'Invalid request payload' },
          details: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
          },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Input validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'Invalid email address format' },
              },
            },
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alex.chen@university.edu' },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 100,
            example: 'P@ssw0rdSecure2026!',
            description: 'Must be at least 8 characters long',
          },
          firstName: { type: 'string', example: 'Alex' },
          lastName: { type: 'string', example: 'Chen' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alex.chen@university.edu' },
          password: { type: 'string', example: 'P@ssw0rdSecure2026!' },
        },
      },
      AuthResponseData: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                example: '8f9b3c2e-4b71-482d-8833-2895f514b8a1',
              },
              email: { type: 'string', example: 'alex.chen@university.edu' },
              firstName: { type: 'string', example: 'Alex' },
              lastName: { type: 'string', example: 'Chen' },
              role: { type: 'string', enum: ['STUDENT', 'ADMIN', 'MODERATOR'], example: 'STUDENT' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          accessToken: {
            type: 'string',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            description: 'Short-lived JWT access token (15 mins)',
          },
          refreshToken: {
            type: 'string',
            example: 'd9b7f5e3-1a2c-4e6f-8a0b-c2d4e6f8a0b2',
            description: 'Long-lived token rotation ID (7 days), also set as HTTP-Only cookie',
          },
        },
      },
      CreateClubRequest: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 60, example: 'Robotics & AI Society' },
          description: {
            type: 'string',
            minLength: 10,
            maxLength: 1000,
            example: 'Fostering hands-on autonomous robotics and machine learning research.',
          },
          bannerUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e',
          },
        },
      },
      UpdateClubRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 3,
            maxLength: 60,
            example: 'Robotics & Autonomous Systems',
          },
          description: { type: 'string', minLength: 10, maxLength: 1000 },
          bannerUrl: { type: 'string', format: 'uri', nullable: true },
        },
      },
      ClubResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f' },
          name: { type: 'string', example: 'Robotics & AI Society' },
          description: {
            type: 'string',
            example: 'Fostering hands-on autonomous robotics research.',
          },
          bannerUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          memberCount: { type: 'integer', example: 42 },
        },
      },
      AddClubMemberRequest: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            example: '8f9b3c2e-4b71-482d-8833-2895f514b8a1',
          },
          role: { type: 'string', enum: ['LEAD', 'MODERATOR', 'MEMBER'], default: 'MEMBER' },
        },
      },
      CreateEventRequest: {
        type: 'object',
        required: ['title', 'description', 'location', 'startTime', 'endTime', 'capacity'],
        properties: {
          title: {
            type: 'string',
            minLength: 3,
            maxLength: 100,
            example: 'Annual AI Hackathon 2026',
          },
          description: {
            type: 'string',
            minLength: 10,
            example: '48-hour competitive autonomous agent build-a-thon with $10k prizes.',
          },
          location: { type: 'string', example: 'Engineering Hall, Room 402' },
          startTime: { type: 'string', format: 'date-time', example: '2026-10-15T09:00:00Z' },
          endTime: { type: 'string', format: 'date-time', example: '2026-10-17T17:00:00Z' },
          capacity: {
            type: 'integer',
            minimum: 1,
            maximum: 10000,
            example: 200,
            description: 'Maximum ticket reservation capacity',
          },
        },
      },
      EventResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'e1d2c3b4-a5f6-7890-1234-56789abcdef0' },
          clubId: {
            type: 'string',
            format: 'uuid',
            example: 'c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f',
          },
          title: { type: 'string', example: 'Annual AI Hackathon 2026' },
          description: { type: 'string', example: '48-hour competitive build-a-thon.' },
          location: { type: 'string', example: 'Engineering Hall, Room 402' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          capacity: { type: 'integer', example: 200 },
          reservedCount: { type: 'integer', example: 45 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TicketResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 't1a2b3c4-d5e6-7890-abcd-ef1234567890' },
          eventId: {
            type: 'string',
            format: 'uuid',
            example: 'e1d2c3b4-a5f6-7890-1234-56789abcdef0',
          },
          userId: {
            type: 'string',
            format: 'uuid',
            example: '8f9b3c2e-4b71-482d-8833-2895f514b8a1',
          },
          ticketNumber: { type: 'string', example: 'TKT-2026-0046' },
          status: { type: 'string', enum: ['CONFIRMED', 'CANCELLED'], example: 'CONFIRMED' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      HealthResponseData: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          uptime: { type: 'number', example: 1243.5 },
          timestamp: { type: 'string', format: 'date-time', example: '2026-09-04T03:50:00.000Z' },
          environment: { type: 'string', example: 'production' },
        },
      },
      CreatePostRequest: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: {
            type: 'string',
            minLength: 5,
            maxLength: 120,
            example: 'Hackathon Partner Search',
          },
          content: {
            type: 'string',
            minLength: 10,
            maxLength: 10000,
            example: 'Looking for a frontend developer proficient with React.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['hackathon', 'react'],
          },
        },
      },
      UpdatePostRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 120 },
          content: { type: 'string', minLength: 10, maxLength: 10000 },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      PostResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'p1a2b3c4-d5e6-7890-abcd-ef1234567890' },
          authorId: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Hackathon Partner Search' },
          content: { type: 'string', example: 'Looking for a frontend developer.' },
          tags: { type: 'array', items: { type: 'string' }, example: ['hackathon', 'react'] },
          isEdited: { type: 'boolean', example: false },
          isDeleted: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          author: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              firstName: { type: 'string', example: 'Jane' },
              lastName: { type: 'string', example: 'Doe' },
              avatarUrl: { type: 'string', nullable: true },
            },
          },
          _count: {
            type: 'object',
            properties: {
              comments: { type: 'integer', example: 5 },
              likes: { type: 'integer', example: 12 },
            },
          },
          isLikedByCaller: { type: 'boolean', example: false },
        },
      },
      CreateCommentRequest: {
        type: 'object',
        required: ['content'],
        properties: {
          content: {
            type: 'string',
            minLength: 2,
            maxLength: 2000,
            example: 'I am interested in joining!',
          },
          parentId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of parent comment to reply to (max 3-level depth)',
          },
        },
      },
      UpdateCommentRequest: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 2, maxLength: 2000 },
        },
      },
      CommentResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          postId: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
          content: { type: 'string', example: 'I am interested in joining!' },
          isEdited: { type: 'boolean', example: false },
          isDeleted: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
          author: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              firstName: { type: 'string', example: 'Alex' },
              lastName: { type: 'string', example: 'Chen' },
              avatarUrl: { type: 'string', nullable: true },
            },
          },
          _count: {
            type: 'object',
            properties: {
              likes: { type: 'integer', example: 3 },
              replies: { type: 'integer', example: 1 },
            },
          },
          isLikedByCaller: { type: 'boolean', example: false },
        },
      },
      LikeResponseData: {
        type: 'object',
        properties: {
          liked: { type: 'boolean', example: true },
          totalLikes: { type: 'integer', example: 13 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'System Health & Liveness Probe',
        description:
          'Returns server uptime, operational health status, and environment runtime metadata.',
        responses: {
          '200': {
            description: 'System is healthy and responsive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/HealthResponseData' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register New Student Account',
        description:
          'Registers a student, hashes the password with Argon2id (RFC 9106), and issues initial JWT tokens.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthResponseData' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error (e.g. password too short, invalid email format)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Conflict (Email already registered)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate User & Issue Tokens',
        description:
          'Verifies Argon2id password hash, creates a Redis Token Family, and returns access token + refresh cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthResponseData' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate Refresh Token',
        description:
          'Performs Token Rotation. If an expired or replayed token is detected, the entire Token Family is revoked.',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': {
            description: 'New access token issued and refresh token rotated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthResponseData' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid, missing, or compromised refresh token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout & Revoke Token Family',
        description: 'Blacklists current JWT in Redis and destroys the active session cookie.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get Current Authenticated User Profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'User profile retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthResponseData/properties/user' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized or expired JWT',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/clubs': {
      get: {
        tags: ['Clubs'],
        summary: 'List Campus Clubs',
        description: 'Retrieves clubs with pagination and optional search query filter.',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
            description: 'Page number',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10 },
            description: 'Number of items per page',
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter clubs by name or description',
          },
        ],
        responses: {
          '200': {
            description: 'List of clubs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ClubResponseData' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Clubs'],
        summary: 'Create New Campus Club',
        description: 'Registers a new club. Authenticated user is automatically assigned as LEAD.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateClubRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Club created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/ClubResponseData' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Club name already exists',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/clubs/{id}': {
      get: {
        tags: ['Clubs'],
        summary: 'Get Club Details by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Club details retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/ClubResponseData' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Club not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Clubs'],
        summary: 'Update Club Information',
        description: 'Requires LEAD or ADMIN role in the club.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateClubRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Club updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/ClubResponseData' },
                  },
                },
              },
            },
          },
          '403': {
            description: 'Forbidden (Not a club lead or admin)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Clubs'],
        summary: 'Delete Club',
        description: 'Requires ADMIN or club LEAD role.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Club deleted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
        },
      },
    },
    '/clubs/{clubId}/members': {
      get: {
        tags: ['Clubs'],
        summary: 'List Club Members',
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'List of club members and their roles',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          userId: { type: 'string', format: 'uuid' },
                          role: { type: 'string', enum: ['LEAD', 'MODERATOR', 'MEMBER'] },
                          joinedAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Clubs'],
        summary: 'Add or Invite Member to Club',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddClubMemberRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Member added successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
        },
      },
    },
    '/clubs/{clubId}/events': {
      post: {
        tags: ['Events'],
        summary: 'Create Event for Club',
        description: 'Requires LEAD or MODERATOR role in the target club.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'clubId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateEventRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Event created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/EventResponseData' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/events': {
      get: {
        tags: ['Events'],
        summary: 'List All Upcoming Events',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10 },
          },
        ],
        responses: {
          '200': {
            description: 'List of events',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/EventResponseData' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/events/{id}': {
      get: {
        tags: ['Events'],
        summary: 'Get Event Details & Remaining Capacity',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Event details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/EventResponseData' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/events/{id}/tickets': {
      post: {
        tags: ['Events'],
        summary: 'Reserve Ticket (Concurrency-Protected & Idempotent)',
        description: `
Executes a high-concurrency ticket purchase with:
1. **Pessimistic Row Locking (\`SELECT FOR UPDATE\`)**: Prevents overselling when hundreds of students attempt to book simultaneously.
2. **RFC 9440 Idempotency**: Pass the \`Idempotency-Key\` header to safely retry requests without double-booking or duplicate charges.
        `,
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            $ref: '#/components/parameters/IdempotencyKeyHeader',
          },
        ],
        responses: {
          '201': {
            description: 'Ticket reserved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/TicketResponseData' },
                  },
                },
              },
            },
          },
          '409': {
            description: 'Event is at full capacity (Sold Out) or user already has a ticket',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      get: {
        tags: ['Events'],
        summary: 'List Tickets / Attendees for Event',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'List of tickets',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TicketResponseData' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/posts': {
      get: {
        tags: ['Posts'],
        summary: 'List Community Posts (Feed)',
        description:
          'Retrieves active forum posts with pagination, tag filtering, search, and sorting (latest or popular).',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'tag', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['latest', 'popular'], default: 'latest' },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated list of posts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        posts: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/PostResponseData' },
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            page: { type: 'integer', example: 1 },
                            limit: { type: 'integer', example: 10 },
                            totalCount: { type: 'integer', example: 45 },
                            totalPages: { type: 'integer', example: 5 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Posts'],
        summary: 'Create New Discussion Post',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePostRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Post created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        post: { $ref: '#/components/schemas/PostResponseData' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/posts/{id}': {
      get: {
        tags: ['Posts'],
        summary: 'Get Post Details by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Post details retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        post: { $ref: '#/components/schemas/PostResponseData' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': { description: 'Post not found' },
        },
      },
      patch: {
        tags: ['Posts'],
        summary: 'Update Discussion Post',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdatePostRequest' } },
          },
        },
        responses: {
          '200': { description: 'Post updated' },
          '403': { description: 'Forbidden (Only author or admin may edit)' },
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Soft-Delete Discussion Post',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Post soft-deleted (replies preserved)' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/posts/{id}/like': {
      post: {
        tags: ['Posts'],
        summary: 'Toggle Upvote / Like on Post',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Like toggled',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/LikeResponseData' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/posts/{postId}/comments': {
      get: {
        tags: ['Posts'],
        summary: 'List Threaded Comments for Post',
        parameters: [
          {
            name: 'postId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Tree of threaded comments (max 3-levels)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        comments: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/CommentResponseData' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Posts'],
        summary: 'Add Comment or Reply to Post',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'postId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateCommentRequest' } },
          },
        },
        responses: {
          '201': { description: 'Comment created' },
          '400': { description: 'Max 3-level nesting depth exceeded' },
        },
      },
    },
    '/posts/{postId}/comments/{commentId}': {
      patch: {
        tags: ['Posts'],
        summary: 'Update Comment Text',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'postId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'commentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateCommentRequest' } },
          },
        },
        responses: {
          '200': { description: 'Comment updated' },
          '403': { description: 'Forbidden' },
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Soft-Delete Comment',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'postId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'commentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Comment soft-deleted' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/posts/{postId}/comments/{commentId}/like': {
      post: {
        tags: ['Posts'],
        summary: 'Toggle Upvote / Like on Comment',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'postId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'commentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Comment like toggled',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/LikeResponseData' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * Custom Enterprise Dark Theme CSS & UI configuration
 */
export const swaggerUiOptions: SwaggerUiOptions = {
  customSiteTitle: 'CampusHub Enterprise API Docs',
  customCss: `
    .swagger-ui .topbar {
      background-color: #0d1117;
      border-bottom: 2px solid #30363d;
      padding: 12px 0;
    }
    .swagger-ui .topbar .topbar-wrapper a span {
      color: #58a6ff;
      font-weight: 700;
      font-size: 1.25rem;
    }
    .swagger-ui .info h2 {
      color: #1f2937;
      font-weight: 800;
    }
    .swagger-ui .info .title small.version-stamp {
      background-color: #2563eb;
      border-radius: 6px;
      padding: 4px 8px;
    }
    .swagger-ui .opblock.opblock-post {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.05);
    }
    .swagger-ui .opblock.opblock-get {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.05);
    }
    .swagger-ui .btn.authorize {
      background-color: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
      border-radius: 6px;
    }
    .swagger-ui .btn.authorize svg {
      fill: #ffffff;
    }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
  },
};
