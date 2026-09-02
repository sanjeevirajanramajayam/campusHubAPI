# CampusHub Backend: Engineering Handbook & Comprehensive Learning Guide

> **Core Philosophy**:  
> *"Understand why each technology and architectural pattern is needed, how it works underneath, and how to implement it correctly. Never blindly copy code or hoard dependencies."*

This handbook is our definitive project reference document. It breaks down every single architectural layer, technology decision, backend pattern, and implementation detail for the **CampusHub** project, with thorough explanations and technical reasoning.

---

## Table of Contents
1. [Project Overview & Domain Modeling](#1-project-overview--domain-modeling)
2. [Architectural Philosophy: Hybrid Layered Architecture](#2-architectural-philosophy-hybrid-layered-architecture)
3. [Technology Stack & Deep Technical Rationale](#3-technology-stack--deep-technical-rationale)
4. [Folder Structure & Code Organization Strategy](#4-folder-structure--code-organization-strategy)
5. [Object-Oriented Programming (OOP) & SOLID Principles in Practice](#5-object-oriented-programming-oop--solid-principles-in-practice)
6. [Data Layer: PostgreSQL, Prisma ORM, & Database Fundamentals](#6-data-layer-postgresql-prisma-orm--database-fundamentals)
7. [Authentication & Authorization Deep Dive](#7-authentication--authorization-deep-dive)
8. [API Design, Validation & Error Handling Standards](#8-api-design-validation--error-handling-standards)
9. [Caching & Performance with Redis](#9-caching--performance-with-redis)
10. [Asynchronous Workflows: BullMQ & Queues](#10-asynchronous-workflows-bullmq--queues)
11. [File Storage Architecture](#11-file-storage-architecture)
12. [Real-time Communication with WebSockets](#12-real-time-communication-with-websockets)
13. [Security Best Practices](#13-security-best-practices)
14. [Testing Strategy (Unit, Integration & E2E)](#14-testing-strategy-unit-integration--e2e)
15. [Observability: Structured Logging & Health Checks](#15-observability-structured-logging--health-checks)
16. [DevOps, Docker & Containerization](#16-devops-docker--containerization)
17. [Step-by-Step Learning & Implementation Roadmap](#17-step-by-step-learning--implementation-roadmap)

---

## 1. Project Overview & Domain Modeling

CampusHub is a production-grade college community platform designed to facilitate student interactions, campus clubs, events, project collaborations, and communication.

### Core Domain Entities
- **User / Student / Faculty / Admin**: Platform actors with specific roles, verification statuses, and academic metadata.
- **Club**: Student organizations with member rosters, leadership hierarchies (Club Admin), and moderation needs.
- **Club Membership**: Relational join entity managing role levels (`MEMBER`, `LEAD`, `ADMIN`) and join dates.
- **Event**: Campus happenings with strict capacities, schedules, location/link data, and registration requirements.
- **Event Registration**: Manages state machine transitions (`PENDING`, `CONFIRMED`, `WAITLISTED`, `CANCELLED`).
- **Post & Comment**: Social forum feeds with nesting, author relations, reactions, and content moderation.
- **Project Collaboration**: Student project listings seeking contributors and tracking skills.
- **Notification**: User-targeted alerts across channels (In-app, Email, Push).
- **File / Asset**: Metadata for uploaded media (avatars, banners, posters, PDFs).

---

## 2. Architectural Philosophy: Hybrid Layered Architecture

### The Request Flow
Every request follows a strict, unidirectional flow:

```
[HTTP Request]
       │
       ▼
   [Route]            --> Defines URL, HTTP method, attaches middleware (auth, validation)
       │
       ▼
 [Controller]         --> Handles HTTP protocol: parses query/body/params, returns HTTP status codes
       │
       ▼
   [Service]          --> Orchestrates business workflows, transactions, domain decisions
       │
       ▼
 [Domain Model]       --> Encapsulates business rules and self-validating state transitions
       │
       ▼
  [Repository]        --> Abstract data interface for persistence operations
       │
       ▼
 [Prisma / DB]        --> Physical query execution against PostgreSQL
```

### Why Layer Separation Matters
1. **Decoupling from Frameworks**: The core business logic in the Service and Domain layers does not know or care whether requests come from Express, Fastify, a CLI tool, or a gRPC handler.
2. **Testability**: Services can be unit-tested in isolation by mocking the Repository interface without spinning up a live database.
3. **Single Responsibility**: Controllers do not run database queries; Repositories do not make business decisions (e.g., checking if an event is full).

---

## 3. Technology Stack & Deep Technical Rationale

| Area | Choice | Why This Specific Tool? (Technical Reasoning) |
|---|---|---|
| **Runtime** | **Node.js** (LTS) | Asynchronous, event-driven I/O ideal for high-concurrency web APIs; vast ecosystem. |
| **Language** | **TypeScript** | Static typing prevents runtime crashes, enables strict domain modeling, explicit interfaces, and self-documenting code. |
| **Framework** | **Express.js** | Minimalist, unopinionated foundation that allows us to build clean custom architectures from first principles. |
| **Database** | **PostgreSQL** | ACID-compliant relational DB with support for complex relationships, transactions, indexes, JSONB, and constraint integrity. |
| **ORM** | **Prisma** | End-to-end type safety generated directly from the database schema, safe migrations, and intuitive query syntax. |
| **Validation** | **Zod** | Runtime schema validation with automatic TypeScript type inference, guaranteeing valid inputs before hitting controllers. |
| **Auth** | **JWT + Cookies** | Stateless short-lived access tokens paired with secure HTTP-only refresh tokens for robust security and scalability. |
| **Hashing** | **Argon2** | Winner of the Password Hashing Competition; more resistant to GPU/ASIC cracking attacks than bcrypt. |
| **Caching** | **Redis** | In-memory key-value store with sub-millisecond latency for caching, rate limiting, and queue backends. |
| **Queues** | **BullMQ** | Robust Redis-backed background job processing supporting delayed jobs, retries, and rate limiting. |
| **Storage** | **S3 / Cloudinary** | Dedicated object storage avoids overloading the relational DB and web server disk with binary blobs. |
| **Testing** | **Vitest + Supertest** | Lightning-fast test runner with ESM/TS native support paired with HTTP assertion tools. |
| **Logging** | **Pino** | Extremely fast, low-overhead structured JSON logger essential for production log parsing and metric extraction. |

---

## 4. Folder Structure & Code Organization Strategy

We use a **modular/feature-first** architecture within a standard layered design.

```text
campushub/
├── prisma/
│   ├── schema.prisma            # Single source of truth for database models
│   ├── migrations/              # Generated SQL migration history
│   └── seed.ts                  # Development database seed script
├── src/
│   ├── config/                  # Environment variable schema & application constants
│   ├── infrastructure/          # External integrations (Prisma client, Redis client, S3, Email)
│   ├── middleware/              # Global Express middlewares (Auth, Error handling, Rate limiting)
│   ├── common/                  # Shared utilities, custom errors, base repository/service types
│   ├── modules/                 # Feature-based domain modules
│   │   ├── auth/                # Authentication & Session Management
│   │   ├── users/               # User profiles & settings
│   │   ├── clubs/               # Club management & memberships
│   │   ├── events/              # Events, capacities & registrations
│   │   ├── posts/               # Forum posts, feeds & tags
│   │   ├── comments/            # Post comments & replies
│   │   ├── projects/            # Student project collaborations
│   │   └── notifications/       # Multi-channel notification delivery
│   │       ├── domain/          # (Optional) Domain entities with business logic
│   │       ├── dto/             # Data Transfer Objects & Zod validation schemas
│   │       ├── routes.ts        # Express route definitions
│   │       ├── controller.ts    # Request/response translation
│   │       ├── service.ts       # Core business logic & workflows
│   │       ├── repository.ts    # Database access implementation & interfaces
│   │       └── index.ts         # Module factory / dependency injection wiring
│   ├── app.ts                   # Express application setup & middleware pipeline
│   └── server.ts                # HTTP server bootstrap & graceful shutdown listeners
├── tests/                       # Global integration & E2E test suites
├── Dockerfile                   # Multi-stage production container image
├── docker-compose.yml           # Local development environment (Postgres, Redis)
├── tsconfig.json                # Strict TypeScript configuration
└── package.json                 # Project dependencies & scripts
```

---

## 5. Object-Oriented Programming (OOP) & SOLID Principles in Practice

CampusHub avoids two extremes: "everything is a procedural script" and "everything is an over-engineered Java-style class hierarchy".

### The Hybrid Model
- **Routes & Controllers**: Functional style (lightweight handler functions or concise classes).
- **Services & Repositories**: Class-based with **Dependency Injection** via constructors for loose coupling and testability.
- **Domain Entities**: Rich domain classes used where business rules, state invariants, and behaviors live together (e.g., `Event`, `ClubMembership`).

### SOLID Principles Explained for CampusHub
1. **Single Responsibility Principle (SRP)**:
   * *Bad*: `EventController` parses request, validates date, calculates pricing, saves to DB, and sends email.
   * *Good*: Controller parses input; Service handles workflow; Repository saves; NotificationService queues email.
2. **Open/Closed Principle (OCP)**:
   * System components should be open for extension, closed for modification.
   * *Example*: Adding a new notification method (`DiscordSender`) should not require modifying the existing `NotificationService` core logic.
3. **Liskov Substitution Principle (LSP)**:
   * Subclasses or interface implementations must be swappable without breaking the application.
   * *Example*: `PostgresEventRepository` and `InMemoryEventRepository` both implement `IEventRepository` and adhere to the exact same contract.
4. **Interface Segregation Principle (ISP)**:
   * Do not force consumers to depend on methods they don't use. Break bloated interfaces into targeted, cohesive contracts.
5. **Dependency Inversion Principle (DIP)**:
   * High-level modules (Services) must depend on abstractions (Interfaces), not concrete low-level implementations (Prisma instances).

---

## 6. Data Layer: PostgreSQL, Prisma ORM, & Database Fundamentals

### Key Concepts to Master
1. **Relational Constraints**: Primary Keys (UUIDv4/CUID), Foreign Keys with `ON DELETE CASCADE` or `RESTRICT`, `UNIQUE` constraints.
2. **Relationships**:
   * *One-to-One*: User Profile to User Settings.
   * *One-to-Many*: Club to Events, User to Posts.
   * *Many-to-Many*: Students to Clubs (via `ClubMembership`), Students to Events (via `EventRegistration`).
3. **Transactions & ACID**:
   * Critical for operations like Event Registration: Decrement capacity + Create registration in an atomic transaction (`prisma.$transaction`).
4. **Indexing Strategy**:
   * Create B-tree indexes on foreign keys and frequently filtered/sorted columns (e.g., `authorId`, `clubId`, `createdAt`).
   * Composite indexes for compound queries (e.g., `@@index([clubId, eventDate])`).
5. **Handling N+1 Query Problems**:
   * Avoiding multiple sequential queries inside loops by utilizing proper Prisma `include`, `select`, or batching techniques.

---

## 7. Authentication & Authorization Deep Dive

### Authentication Architecture (JWT + Refresh Tokens)
1. **Access Token (Short-Lived, e.g., 15 mins)**:
   * Stored in memory / Authorization header (`Bearer <token>`).
   * Contains user identity (`userId`, `role`).
2. **Refresh Token (Long-Lived, e.g., 7 days)**:
   * Stored as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
   * Stored (hashed) in the database with revocation tracking.
3. **Token Rotation**:
   * Every time a refresh token is used to obtain a new access token, the old refresh token is invalidated and a new one is issued, preventing replay attacks.

### Authorization (Role-Based & Resource-Based RBAC)
- **Role Hierarchy**: `STUDENT` < `CLUB_ADMIN` < `ADMIN`.
- **Resource Ownership Middleware**: Ensures that a user can only edit or delete their own posts, comments, or profile unless they hold `ADMIN` privileges.

---

## 8. API Design, Validation & Error Handling Standards

### Standard JSON Response Envelope
All API endpoints return predictable responses:

```json
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 } // optional pagination
}

// Error Response
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Event with id 123 does not exist",
    "details": []
  }
}
```

### Centralized Error Hierarchy
- Inherit from custom `AppError` base class:
  - `ValidationError` (HTTP 400)
  - `UnauthorizedError` (HTTP 401)
  - `ForbiddenError` (HTTP 403)
  - `NotFoundError` (HTTP 404)
  - `ConflictError` (HTTP 409)
  - `InternalServerError` (HTTP 500)
- A single global Express Error Middleware catches all thrown errors and guarantees no raw stack traces leak to clients in production.

---

## 9. Caching & Performance with Redis

### When and Why to Cache
- **Read-Heavy Endpoints**: Club lists, popular events, trending posts.
- **Cache-Aside Pattern**:
  1. Check Redis for key `events:upcoming`.
  2. If hit: return cached JSON.
  3. If miss: query PostgreSQL via Prisma, write result to Redis with a TTL (Time to Live), return data.
- **Cache Invalidation**: Delete or update the Redis key whenever an event is created, modified, or deleted.

---

## 10. Asynchronous Workflows: BullMQ & Queues

### Why Asynchronous Processing?
Never block the HTTP request/response cycle with slow operations (e.g., sending emails, processing images, generating reports).

### Architecture
- **Producer (Express API)**: Pushes job payload (e.g., `{ userId, eventId }`) into a BullMQ queue and immediately returns `202 Accepted` or `200 OK` to the client.
- **Consumer / Worker**: Separate background process picking up jobs from Redis, executing with retry policies and exponential backoff.

---

## 11. File Storage Architecture

- **Approach**: Direct-to-Storage via Presigned URLs (or multipart upload via controller to S3/Cloudinary).
- **Rule**: Never store binary image/PDF files in the relational database. Only store the resulting storage URL, MIME type, file size, and owner metadata in PostgreSQL.

---

## 12. Real-time Communication with WebSockets

- Integrated via Socket.IO or native `ws`.
- Authenticated via JWT during handshake.
- Use cases: Live campus event updates, real-time notification toasts, and club discussion channels.

---

## 13. Security Best Practices

1. **Helmet**: Set secure HTTP headers (HSTS, CSP, X-Frame-Options).
2. **CORS**: Explicit whitelist of allowed client origins (no open `*` in production).
3. **Rate Limiting**: Prevent brute force attacks on `/auth/login` and DoS on public APIs using Redis rate limiters.
4. **Input Sanitization**: Strip dangerous HTML/scripts to prevent XSS.
5. **Parameter Tampering Prevention**: Validate all incoming bodies with strict Zod schemas (`.strict()`).

---

## 14. Testing Strategy (Unit, Integration & E2E)

1. **Unit Tests**: Test business rules in isolation (Domain methods, Utility helpers, Services with mocked Repositories).
2. **Integration Tests**: Test routes, controllers, and Prisma queries against a test PostgreSQL database using Supertest.
3. **E2E Tests**: Validate complete user journeys (Registration → Login → Join Club → Register Event).

---

## 15. Observability: Structured Logging & Health Checks

- **Pino Logger**: Log format as structured JSON with correlation IDs (Request IDs) passed across request lifecycles.
- **Health Check Endpoint**: `/health` checking both PostgreSQL connection pool status and Redis connectivity.

---

## 16. DevOps, Docker & Containerization

- `docker-compose.yml` provides a one-command development environment:
  - `postgres`: Persistent database container.
  - `redis`: In-memory cache and queue broker.
- Multi-stage `Dockerfile` creating lean, secure, non-root Node.js production images.

---

## 17. Step-by-Step Learning & Implementation Roadmap

| Phase | Focus Milestone | Core Concepts Learned |
|---|---|---|
| **Phase 1** | **Project Setup & Base Architecture** | TypeScript config, Express server, Zod env validation, error middleware |
| **Phase 2** | **Database & Repository Layer** | PostgreSQL, Prisma schema design, migrations, Repository Pattern |
| **Phase 3** | **Authentication & Security** | Argon2 hashing, JWT access/refresh tokens, HttpOnly cookies, Auth middleware |
| **Phase 4** | **Domain Modules & CRUD** | Users, Clubs, Events, Posts with Service layer validation and pagination |
| **Phase 5** | **Caching & Queues** | Redis cache-aside, BullMQ workers, email notifications |
| **Phase 6** | **Files, Real-time & Polish** | File uploads, WebSockets, comprehensive test suites, Dockerization |

---
*This handbook serves as the master blueprint for every line of code written in the CampusHub backend.*
