# CampusHub Backend Project --- Conversation Summary

## 1. Project Goal

The goal is to build **CampusHub**, a serious, production-style backend
project rather than a basic CRUD application.

CampusHub is envisioned as a college platform where students can:

-   Create profiles
-   Join clubs
-   Participate in events
-   Create posts and comments
-   Collaborate on projects
-   Register for events
-   Receive notifications
-   Share files
-   Interact with other students

The project should be used as a **learning vehicle for backend
engineering**, with progressively more advanced concepts introduced over
time.

------------------------------------------------------------------------

## 2. Core Technology Stack

The project will use **Node.js** rather than Python.

Recommended stack:

  Area                Technology
  ------------------- -------------------------------
  Runtime             Node.js
  Language            TypeScript
  Framework           Express.js
  Database            PostgreSQL
  ORM                 Prisma
  Validation          Zod
  Authentication      JWT
  Password hashing    Argon2
  Cache               Redis
  Background jobs     BullMQ
  Email               Nodemailer / Resend
  File storage        AWS S3 / Cloudinary
  Testing             Vitest + Supertest
  API documentation   Swagger / OpenAPI
  Logging             Pino
  Security            Helmet + CORS + rate limiting
  Containers          Docker + Docker Compose
  CI/CD               GitHub Actions
  Deployment          Cloud platform

TypeScript is preferred over plain JavaScript because the project will
deliberately incorporate OOP, interfaces, abstractions, dependency
injection, and strong typing.

------------------------------------------------------------------------

## 3. Main Backend Architecture

The proposed request flow is:

``` text
HTTP Request
     ↓
   Route
     ↓
 Controller
     ↓
  Service
     ↓
 Domain / Business Logic
     ↓
 Repository
     ↓
  Prisma
     ↓
PostgreSQL
```

### Responsibilities

  Layer            Responsibility
  ---------------- -----------------------------------
  Route            Maps URLs to controllers
  Controller       Handles HTTP concerns
  Service          Contains business logic
  Domain objects   Model important business behavior
  Repository       Handles database/data access
  Prisma           ORM
  PostgreSQL       Persistent storage

The project should use **Service + Repository architecture** rather than
putting business logic and database queries directly inside routes.

------------------------------------------------------------------------

## 4. Recommended Project Structure

A feature/module-based structure is preferred:

``` text
campushub/
│
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── posts/
│   │   ├── comments/
│   │   ├── clubs/
│   │   ├── events/
│   │   ├── projects/
│   │   └── notifications/
│   │
│   ├── middleware/
│   ├── config/
│   ├── infrastructure/
│   │   ├── prisma/
│   │   ├── redis/
│   │   ├── email/
│   │   └── storage/
│   │
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env
├── .env.example
└── README.md
```

Each module can contain its own routes, controller, service, repository,
schemas, types, and domain classes where appropriate.

------------------------------------------------------------------------

# 5. OOP in CampusHub

OOP **is appropriate for this application**, but the entire application
should not be forced into a class-based design.

The preferred approach is a **hybrid architecture**:

``` text
Express / HTTP layer
    → mostly functions/modules

Business / Domain layer
    → OOP where useful

Repository layer
    → classes or modules

Database
    → Prisma + PostgreSQL
```

The goal is not "everything must be a class."

The goal is:

> Use OOP where objects have meaningful behavior, state, and business
> rules.

------------------------------------------------------------------------

## 6. Potential Domain Classes

Possible domain objects include:

``` text
User
Student
Faculty
Admin
Club
Event
Post
Comment
Project
Course
Notification
File
```

For example:

``` ts
class Event {
    constructor(
        public title: string,
        public capacity: number
    ) {}

    register(student: Student) {
        if (this.isFull()) {
            throw new Error("Event is full");
        }

        // registration logic
    }

    private isFull() {
        // ...
    }
}
```

This is a useful use of OOP because the `Event` contains behavior and
protects its business rules.

------------------------------------------------------------------------

## 7. OOP Concepts to Practice

CampusHub can deliberately incorporate:

### Encapsulation

Use private/protected state and expose controlled behavior.

### Abstraction

Use interfaces and abstractions for things such as repositories and
notification systems.

### Inheritance

Potentially use inheritance where it genuinely represents the domain,
such as specialized user types, but do not force inheritance everywhere.

### Polymorphism

For example:

``` ts
interface NotificationSender {
    send(message: string): Promise<void>;
}

class EmailSender implements NotificationSender {
    async send(message: string) {
        // send email
    }
}

class PushSender implements NotificationSender {
    async send(message: string) {
        // send push notification
    }
}
```

A notification service can work with either implementation.

### Composition

Objects can contain/use other objects rather than relying entirely on
inheritance.

### Dependency Injection

For example:

``` ts
class UserService {
    constructor(
        private userRepository: UserRepository
    ) {}
}
```

### SOLID Principles

The project can be used to learn and apply:

-   Single Responsibility Principle
-   Open/Closed Principle
-   Liskov Substitution Principle
-   Interface Segregation Principle
-   Dependency Inversion Principle

### Important OOP principle

Do **not** create classes simply to say that the project uses OOP.

For example, a simple database lookup does not necessarily need an
elaborate class hierarchy.

------------------------------------------------------------------------

# 8. Authentication

CampusHub should eventually support:

``` text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/me
```

Concepts:

-   Password hashing
-   JWT
-   Access tokens
-   Refresh tokens
-   Cookies
-   Authentication middleware
-   Token expiration
-   Email verification
-   Password reset

------------------------------------------------------------------------

# 9. Authorization

The platform can support roles such as:

``` text
STUDENT
CLUB_ADMIN
ADMIN
```

Authorization determines what each user is allowed to do.

Example:

``` text
Student
  → create posts
  → join clubs
  → register for events

Club Admin
  → manage club
  → create/manage events

Admin
  → manage users
  → moderate content
```

Important distinction:

> Authentication = Who are you?

> Authorization = What are you allowed to do?

------------------------------------------------------------------------

# 10. Database

Use PostgreSQL and Prisma, while still learning the SQL concepts
underneath.

Potential entities:

``` text
users
posts
comments
clubs
club_members
events
event_registrations
projects
courses
notifications
files
```

Important database concepts to learn:

-   Primary keys
-   Foreign keys
-   One-to-one relationships
-   One-to-many relationships
-   Many-to-many relationships
-   Normalization
-   Joins
-   Constraints
-   Transactions
-   ACID
-   Indexes
-   Composite indexes
-   Query optimization
-   EXPLAIN
-   Connection pooling
-   Migrations
-   Database locking
-   Isolation levels

------------------------------------------------------------------------

# 11. REST API Features

The API should eventually support:

-   CRUD
-   Pagination
-   Cursor pagination
-   Filtering
-   Sorting
-   Searching
-   API versioning
-   Consistent response formats
-   Consistent error formats
-   Validation
-   OpenAPI/Swagger documentation
-   Idempotency where appropriate

Example:

``` http
GET /api/v1/posts?page=2&limit=20
```

or:

``` http
GET /api/v1/events?club=robotics&sort=latest
```

------------------------------------------------------------------------

# 12. Redis and Performance

Redis can be introduced after the basic application works.

Use Redis for:

-   Caching
-   Temporary data
-   Rate limiting
-   Potential session-related use cases

Example:

``` text
Request
   ↓
Redis?
 ├── YES → cached response
 └── NO
       ↓
   PostgreSQL
       ↓
     Redis
       ↓
   Response
```

Performance concepts:

-   Database indexes
-   Query optimization
-   Caching
-   Pagination
-   Cursor pagination
-   Connection pooling
-   Batching
-   Avoiding N+1 queries
-   CDN concepts

------------------------------------------------------------------------

# 13. Background Jobs

Use **BullMQ + Redis** for asynchronous work.

Example:

``` text
Student registers for event
        ↓
Save registration
        ↓
Return API response
        ↓
Queue email job
        ↓
Worker processes job
        ↓
Send email
```

Learn:

-   Queues
-   Workers
-   Retries
-   Delayed jobs
-   Failed jobs
-   Job priorities
-   Idempotency
-   Dead-letter concepts

------------------------------------------------------------------------

# 14. File Handling

Support:

-   Profile pictures
-   Club logos
-   Event posters
-   Project files

Use object storage such as S3-compatible storage rather than storing
large files directly in PostgreSQL.

Typical flow:

``` text
Client
  ↓
Backend
  ↓
Object Storage
  ↓
File URL / metadata
  ↓
PostgreSQL
```

Learn:

-   Multipart/form-data
-   File validation
-   File size limits
-   Secure file access
-   Presigned URLs
-   Image processing

------------------------------------------------------------------------

# 15. Real-Time Features

CampusHub can eventually include:

-   Chat
-   Real-time notifications
-   Online/offline presence
-   Typing indicators

Technologies:

``` text
WebSockets
Socket.IO
```

Example:

``` text
Student A
   ↓
CampusHub
   ↓
WebSocket
   ↓
Student B
```

------------------------------------------------------------------------

# 16. Notifications and Email

Possible features:

-   Email verification
-   Password reset
-   Welcome emails
-   Event registration confirmation
-   Event reminders
-   In-app notifications
-   Notification preferences

A notification abstraction can demonstrate polymorphism:

``` text
NotificationService
       ↓
NotificationSender
   ┌───┴────┐
   ↓        ↓
 Email     Push
```

------------------------------------------------------------------------

# 17. Security

The project should deliberately cover:

-   Password hashing
-   Secure authentication
-   Authorization
-   Rate limiting
-   CORS
-   CSRF concepts
-   XSS concepts
-   SQL injection prevention
-   Input validation
-   Secure cookies
-   HTTP security headers
-   Secrets/environment variables
-   Token expiration
-   Password reset security
-   OWASP Top 10

Security should be treated as part of the architecture, not as a final
add-on.

------------------------------------------------------------------------

# 18. Testing

Use:

``` text
Vitest
Supertest
```

Test:

-   Unit behavior
-   Services
-   Repositories
-   Authentication
-   Authorization
-   API endpoints
-   Integration flows
-   Error cases

Example:

``` text
POST /auth/login

Valid credentials → 200
Wrong password    → 401
Unknown user      → 401
Invalid input     → 400
```

------------------------------------------------------------------------

# 19. Logging and Observability

Use a structured logger such as **Pino**.

Eventually learn:

-   Application logs
-   Error logs
-   Request latency
-   Error rates
-   CPU/memory metrics
-   Database connection metrics
-   Distributed tracing
-   OpenTelemetry concepts
-   Health checks

The goal is to understand what happens inside:

``` text
Request
 ↓
Controller
 ↓
Service
 ↓
Repository
 ↓
Database
```

and where failures or latency occur.

------------------------------------------------------------------------

# 20. Docker and DevOps

Eventually the project should be runnable with:

``` bash
docker compose up
```

Services can include:

``` text
Node API
PostgreSQL
Redis
Background Worker
```

Then introduce:

-   Linux basics
-   Docker
-   Docker Compose
-   Container networking
-   Reverse proxy
-   Nginx
-   Environment management
-   HTTPS
-   CI/CD
-   GitHub Actions
-   Deployment
-   Database backups

------------------------------------------------------------------------

# 21. Scalability

Advanced topics can eventually be explored:

``` text
              Load Balancer
             /      |                  API    API     API
             \      |      /
                  Redis
                    │
                PostgreSQL
```

Concepts:

-   Horizontal scaling
-   Load balancing
-   Stateless servers
-   Distributed caching
-   Database replication
-   Read replicas
-   Sharding concepts
-   CAP theorem
-   Eventual consistency

These should be learned later rather than implemented immediately.

------------------------------------------------------------------------

# 22. Advanced Backend Concepts

Once the fundamentals are strong, CampusHub can be extended to explore:

-   Concurrency
-   Race conditions
-   Optimistic locking
-   Pessimistic locking
-   Distributed locks
-   Distributed transactions
-   Idempotency
-   Event-driven architecture
-   Pub/Sub
-   Message brokers
-   Sagas
-   Outbox pattern
-   Retry strategies
-   Circuit breakers
-   Kafka concepts

These are advanced topics and should not be added just for complexity.

------------------------------------------------------------------------

# 23. Suggested Development Roadmap

The project should be built progressively.

``` text
1. Node.js + TypeScript
       ↓
2. Express
       ↓
3. Basic REST API
       ↓
4. PostgreSQL
       ↓
5. Prisma
       ↓
6. Repository layer
       ↓
7. Service layer
       ↓
8. Domain/OOP concepts
       ↓
9. Authentication
       ↓
10. Authorization
       ↓
11. Relationships + CRUD
       ↓
12. Validation
       ↓
13. Pagination/search/filtering
       ↓
14. Redis
       ↓
15. File uploads
       ↓
16. Email
       ↓
17. Background jobs
       ↓
18. Real-time features
       ↓
19. Testing
       ↓
20. Logging/observability
       ↓
21. Docker
       ↓
22. CI/CD
       ↓
23. Deployment
       ↓
24. Advanced scalability concepts
```

------------------------------------------------------------------------

# 24. Overall Philosophy

The project should **not** be about collecting technologies.

Avoid:

``` text
"I used 30 technologies."
```

Aim for:

``` text
"I understand why each technology and architectural pattern
is needed, how it works, and how to implement it correctly."
```

Similarly, avoid blindly copying large implementations.

The preferred learning process is:

``` text
Understand the problem
       ↓
Understand the concept
       ↓
Design the solution
       ↓
Attempt implementation
       ↓
Debug
       ↓
Study better implementations
       ↓
Rewrite and understand
       ↓
Test
```

CampusHub should therefore be treated as a **long-term backend
engineering learning project**, with OOP incorporated meaningfully
rather than artificially.
