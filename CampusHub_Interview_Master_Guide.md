# CampusHub Backend: Master Interview Preparation Guide

> **Purpose**:  
> This living document catalogs all **backend engineering, system design, architectural, and coding interview questions** related to every concept, tool, and design decision implemented in CampusHub.  
> Every question is paired with the **underlying technical reasoning, trade-offs, and production-grade answers** expected in senior backend engineering interviews.

---

## Table of Contents
1. [Node.js, TypeScript & Runtime Internals](#1-nodejs-typescript--runtime-internals)
2. [Package Managers & Dependency Management (pnpm vs npm vs Yarn)](#2-package-managers--dependency-management-pnpm-vs-npm-vs-yarn)
3. [Software Architecture & Design Patterns (Layered, SOLID, DI)](#3-software-architecture--design-patterns-layered-solid-di)
4. [Database Engineering & SQL Fundamentals (PostgreSQL & Prisma)](#4-database-engineering--sql-fundamentals-postgresql--prisma)
5. [Authentication, Authorization & Security](#5-authentication-authorization--security)
6. [API Design, Validation & Error Handling (REST, Zod, HTTP Standards)](#6-api-design-validation--error-handling-rest-zod-http-standards)
7. [Caching & In-Memory Data Stores (Redis)](#7-caching--in-memory-data-stores-redis)
8. [Asynchronous Processing, Message Queues & Distributed Tasks (BullMQ)](#8-asynchronous-processing-message-queues--distributed-tasks-bullmq)
9. [Real-time Systems (WebSockets vs Long Polling vs SSE)](#9-real-time-systems-websockets-vs-long-polling-vs-sse)
10. [High-Concurrency Scenarios & Race Conditions](#10-high-concurrency-scenarios--race-conditions)
11. [Testing, Logging & Observability (Vitest, Pino)](#11-testing-logging--observability-vitest-pino)
12. [DevOps, Docker & Production Reliability](#12-devops-docker--production-reliability)

---

## 1. Node.js, TypeScript & Runtime Internals

### Q1: How does Node.js handle thousands of concurrent requests if it is single-threaded?
* **Core Concept**: Event Loop, Non-blocking I/O, Libuv, Thread Pool.
* **Explanation**:
  * Node.js executes JavaScript code on a single thread (the main V8 execution thread).
  * However, asynchronous I/O operations (file system, network sockets, database queries) are delegated to the underlying OS kernel (via `epoll`, `kqueue`, or IOCP on Windows) or to the **Libuv thread pool** (default 4 threads).
  * When an asynchronous operation completes, Libuv places the associated callback into the Event Loop phase queue (e.g., Poll phase, Microtask queue).
  * The main thread simply registers the intent and continues serving subsequent HTTP requests without blocking.
* **Follow-up / Gotcha**: *What blocks the Node.js event loop?*
  * Heavy CPU-bound computation (e.g., JSON parsing massive strings, cryptographic hashing with synchronous functions like `bcrypt.hashSync`, synchronous file reading `fs.readFileSync`, regex with catastrophic backtracking).

### Q2: What is the difference between Microtasks and Macrotasks in Node.js?
* **Explanation**:
  * **Microtasks**: Handled with absolute highest priority immediately after the currently running operation finishes and before moving to the next Event Loop phase.
    * Examples: `process.nextTick()`, `Promise.then()`, `Promise.catch()`, `queueMicrotask()`.
    * Note: `process.nextTick()` has higher priority than standard Promise microtasks in Node.js.
  * **Macrotasks (Timers / I/O / Check)**: Executed during their respective phases of the Libuv event loop.
    * Examples: `setTimeout()`, `setInterval()`, `setImmediate()`, I/O callbacks.

### Q3: Why do we use TypeScript in backend development if it all gets compiled to JavaScript anyway?
* **Explanation**:
  * TypeScript provides **compile-time type safety**. It eliminates entire categories of runtime bugs (e.g., `TypeError: Cannot read properties of undefined`, passing strings instead of numbers, unexpected null values).
  * Enables strict domain contracts (Interfaces, Generics, Enums/Union types) and self-documenting codebases.
  * Facilitates safe refactoring across thousands of files with automated compiler feedback.

---

## 2. Package Managers & Dependency Management (pnpm vs npm vs Yarn)

### Q4: Why use `pnpm` over standard `npm` or `Yarn`? What are "Phantom Dependencies"?
* **Explanation**:
  * **Content-Addressable Storage**: `pnpm` stores package files in a single global content-addressable store (`~/.pnpm-store`). In individual projects, files are **hard-linked** directly to the store, saving gigabytes of disk space.
  * **Elimination of Phantom Dependencies**:
    * `npm` and `Yarn v1` create a **flat** `node_modules` structure via hoisting. If package `A` depends on package `B`, `npm` hoists `B` to the root `node_modules`. Your code could write `import B from 'B'` without ever declaring `B` in your `package.json`. If package `A` updates and drops `B`, your application crashes.
    * `pnpm` uses a **symlinked, non-flat structure**. Only packages explicitly declared in `package.json` are accessible from the project root.
  * **Installation Performance**: `pnpm` skips redundant downloads and disk writes, making CI/CD and local installs significantly faster.

---

## 3. Software Architecture & Design Patterns (Layered, SOLID, DI)

### Q5: Explain the Layered Architecture (Route → Controller → Service → Repository). Why not put database queries in Controllers?
* **Explanation**:
  * **Separation of Concerns**:
    * **Controller**: HTTP protocol handler (validates inputs, unpacks request headers/query/params/body, formats HTTP response, returns status codes).
    * **Service**: Business logic orchestration (calculates pricing, verifies user permissions, validates business rules, triggers domain events, coordinates transactions).
    * **Repository**: Data access abstraction (executes database queries, handles Prisma/SQL syntax, abstracts persistence).
  * **Why decouple?**:
    1. **Reusability**: The same Service method (e.g., `registerForEvent(userId, eventId)`) can be called by an HTTP Controller, a WebSocket handler, a background BullMQ worker, or a CLI script.
    2. **Testability**: You can unit-test business logic in `EventService` by passing a mock repository without needing a running database.

### Q6: What is Dependency Injection (DI) and how does it satisfy the Dependency Inversion Principle (DIP)?
* **Explanation**:
  * **Dependency Inversion Principle (D of SOLID)**: High-level modules (Services) should not depend on low-level modules (Concrete Database Repositories). Both should depend on abstractions (Interfaces).
  * **Dependency Injection**: The design pattern where dependencies are provided (injected) to an object from the outside (typically via the constructor) rather than the object instantiating its dependencies internally with `new`.
  * **Example**:
    ```ts
    // High-level service depends on interface IUserRepository
    class UserService {
      constructor(private readonly userRepo: IUserRepository) {}
    }
    ```
  * In production, we pass `new PrismaUserRepository()`. In unit tests, we pass `new MockUserRepository()`.

### Q7: Why use a "Hybrid OOP + Functional" architecture instead of pure OOP or pure Functional?
* **Explanation**:
  * **Pure OOP drawback in Node/Express**: Forcing every middleware, router, and simple query into classes leads to unnecessary boilerplate and state management overhead.
  * **Pure Functional drawback**: Complex domain logic (e.g., managing state transitions for `EventRegistration` or validating business invariants of a `Club`) becomes scattered across disjointed utility functions without clear encapsulation.
  * **Hybrid approach**: Use functions and modules for stateless I/O pipelines (Express routing, middlewares) and use OOP classes with Dependency Injection where encapsulation, behavior, and polymorphism provide real value (Domain models, Services, Repositories).

---

## 4. Database Engineering & SQL Fundamentals (PostgreSQL & Prisma)

### Q8: What are ACID properties in relational databases?
* **Atomicity**: All operations in a transaction succeed, or none do (All-or-Nothing).
* **Consistency**: A transaction takes the database from one valid state to another, respecting all schema constraints and foreign keys.
* **Isolation**: Concurrent transactions execute without interfering with one another.
* **Durability**: Once a transaction commits, its changes survive system crashes (persisted to write-ahead logs / disk).

### Q9: What is the N+1 query problem, and how do you prevent it in Prisma / SQL?
* **Explanation**:
  * **The Problem**: Fetching 1 parent record, then executing $N$ separate queries in a loop to fetch related child records for each parent.
  * *Example*: Fetching 50 posts, and in a `for` loop executing `SELECT * FROM users WHERE id = post.authorId` (1 initial query + 50 individual queries = 51 database roundtrips).
  * **Solution**:
    * In raw SQL: Use `JOIN` (`SELECT * FROM posts JOIN users ON posts.author_id = users.id`).
    * In Prisma: Use `include: { author: true }` or `select`, which Prisma translates to an optimized single SQL `JOIN` or a batched `WHERE id IN (...)` query.

### Q10: What are Database Indexes? When should you NOT add an index?
* **Explanation**:
  * An index (typically a **B-Tree** in PostgreSQL) is a data structure that allows logarithmic search time ($O(\log N)$) instead of a sequential table scan ($O(N)$).
  * **When to add**:
    * Foreign key columns (`userId`, `clubId`).
    * Columns frequently used in `WHERE`, `ORDER BY`, or `JOIN` clauses.
    * Columns with unique constraints (`email`, `slug`).
  * **When NOT to add**:
    * Low-cardinality columns (e.g., a boolean `isActive` where 50% of rows are true, 50% false).
    * Write-heavy tables where reads are infrequent (every `INSERT`, `UPDATE`, and `DELETE` incurs overhead to update all indexes).

---

## 5. Authentication, Authorization & Security

### Q11: Explain JWT vs Session-based authentication. What are the pros and cons?
* **JWT (Stateless)**:
  * Token contains encoded claims (`userId`, `role`, `exp`) signed by a secret/private key.
  * **Pros**: Stateless; server doesn't need to query database/Redis on every request; scales easily across multiple instances.
  * **Cons**: Hard to revoke immediately before expiration without maintaining a token blocklist.
* **Sessions (Stateful)**:
  * Server generates random session ID, stores session data in Redis/DB, sends cookie to client.
  * **Pros**: Instant revocation by deleting session from Redis.
  * **Cons**: Requires centralized in-memory store lookup on every single request.

### Q12: How do we securely implement Refresh Token Rotation?
* **Architecture**:
  1. User logs in → Server returns short-lived **Access Token** (15 mins) and long-lived **Refresh Token** (7 days) in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
  2. Server stores hashed refresh token in database associated with the user and a token family ID.
  3. When access token expires, client hits `/auth/refresh`.
  4. Server validates refresh token, deletes the old refresh token, generates a **new** access token AND a **new** refresh token (**Rotation**).
  5. **Reuse Detection**: If an already-invalidated refresh token is presented, the server detects potential token theft and immediately revokes all tokens for that user.

### Q13: What is the difference between Authentication and Authorization?
* **Authentication (AuthN)**: *Who are you?* (Verifying identity via credentials, passwords, JWT tokens).
* **Authorization (AuthZ)**: *What are you allowed to do?* (Permissions, Role-Based Access Control `RBAC`, resource ownership checks).

---

## 6. API Design, Validation & Error Handling (REST, Zod, HTTP Standards)

### Q14: What is the difference between `PUT` and `PATCH` in REST APIs?
* **`PUT`**: Complete replacement of the resource. The client must supply all fields; missing fields are reset to default/null. Idempotent.
* **`PATCH`**: Partial update of the resource. The client supplies only the fields to be modified; unmentioned fields remain unchanged.

### Q15: Why perform validation using Zod at the boundary before calling the Controller/Service?
* **Explanation**:
  * **Fail Fast**: Rejects malformed requests immediately with HTTP 400 Bad Request without wasting database or service compute cycles.
  * **Type Narrowing**: Zod schemas (`z.infer<typeof Schema>`) guarantee that runtime payloads match static TypeScript types throughout the rest of the application.
  * **Security**: Stripping unknown fields (`.strict()`) prevents mass assignment vulnerabilities (e.g., a malicious user injecting `"role": "ADMIN"` into a profile update body).

---

## 7. Caching & In-Memory Data Stores (Redis)

### Q16: What is the Cache-Aside (Lazy Loading) pattern?
* **Workflow**:
  1. Application receives request for data (e.g., `GET /clubs/robotics`).
  2. Application checks Redis (`GET club:robotics`).
  3. **Cache Hit**: Data found in Redis → return immediately.
  4. **Cache Miss**: Data not found in Redis → query PostgreSQL via Prisma → write fetched result to Redis with a TTL (`SETEX club:robotics 3600 <data>`) → return data.
* **Cache Invalidation**: When a club is updated (`PATCH /clubs/robotics`), the service executes `DEL club:robotics` to prevent stale reads.

### Q17: What are Cache Penetration, Cache Breakdown, and Cache Stampede (Avalanche)?
* **Cache Penetration**: Requests for non-existent keys bypass cache and hammer DB. *(Fix: Cache `null` results with short TTL or use Bloom filters).*
* **Cache Breakdown**: A single hot key with high traffic expires, causing thousands of concurrent requests to hit the DB simultaneously. *(Fix: Mutex locking / single-flight request coalescing).*
* **Cache Avalanche**: Thousands of keys expire at the exact same second, overloading the DB. *(Fix: Add random jitter to TTLs, e.g., `3600s + Math.random() * 300s`).*

---

## 8. Asynchronous Processing, Message Queues & Distributed Tasks (BullMQ)

### Q18: Why use a Message Queue (BullMQ) instead of executing tasks directly in `async/await`?
* **Explanation**:
  * **HTTP Latency**: Slow operations (sending emails, resizing images, generating PDFs) would keep HTTP connections open, degrading API throughput and user experience.
  * **Fault Tolerance & Retries**: If the email server is temporarily down, a direct `async` call fails and loses data. A message queue automatically retries with exponential backoff.
  * **Rate Limiting Third-Party APIs**: Prevents exceeding rate limits of external providers (e.g., SendGrid, AWS SES) by throttling job worker concurrency.
  * **Graceful Degradation**: Server restarts don't lose pending jobs because BullMQ persists state in Redis.

---

## 9. Real-time Systems (WebSockets vs Long Polling vs SSE)

### Q19: Compare WebSockets, Server-Sent Events (SSE), and Long Polling.
| Feature | WebSockets | Server-Sent Events (SSE) | Long Polling |
|---|---|---|---|
| **Direction** | Full-duplex (Bidirectional) | Unidirectional (Server → Client) | Request/Response cycle |
| **Protocol** | `ws://` or `wss://` (TCP) | HTTP / HTTPS | HTTP / HTTPS |
| **Complexity** | Higher (Stateful connection management) | Low (Standard HTTP stream) | Low (High server overhead) |
| **Best Use Case** | Chat, collaborative editing, gaming | Live notification feeds, stock tickers | Legacy fallback systems |

---

## 10. High-Concurrency Scenarios & Race Conditions

### Q20: How do you prevent double-booking/overselling if 1,000 students try to register for an event with 5 remaining seats at the exact same millisecond?
* **The Problem (Race Condition / Check-Then-Act)**:
  * Two requests read `capacity = 100, registered = 99` simultaneously. Both see 1 seat remaining. Both insert a registration record. Total registered becomes 101 (Oversold).
* **Solutions**:
  1. **Atomic SQL Update with Conditional Check**:
     ```sql
     UPDATE events 
     SET registered_count = registered_count + 1 
     WHERE id = $1 AND registered_count < max_capacity;
     ```
     If affected rows = 0, event is full. This relies on PostgreSQL's row-level locking.
  2. **Pessimistic Locking (`SELECT FOR UPDATE`)**:
     * Locks the specific `Event` row inside a `prisma.$transaction` so concurrent transactions must queue.
  3. **Optimistic Locking**:
     * Add a `version` column. Update only succeeds if version matches: `UPDATE events SET registered_count = 100, version = 2 WHERE id = 1 AND version = 1;`.
  4. **Redis Atomic Operations / Distributed Lock (Redlock)**:
     * Decrement available seats using Redis `DECR` or acquire a distributed lock before DB write.

---

## 11. Testing, Logging & Observability (Vitest, Pino)

### Q21: What is the difference between Unit, Integration, and End-to-End (E2E) tests?
* **Unit Tests**: Test a single isolated function or class method (mocking all external dependencies like DB, network). Fast, high granularity.
* **Integration Tests**: Test how multiple units interact (e.g., Route + Controller + Service + Repository against a real test database container).
* **E2E Tests**: Test the entire application flow from client request to database state to background worker output.

### Q22: Why use structured JSON logging (Pino) instead of `console.log`?
* **Explanation**:
  * `console.log` is synchronous in certain Node streams (can block the event loop) and outputs unparsed text.
  * Structured JSON logging prints machine-readable JSON: `{"level":"info","time":1698234,"reqId":"abc","msg":"User registered"}`.
  * Modern log aggregation platforms (Datadog, AWS CloudWatch, Elasticsearch, Grafana Loki) can index, filter, search, and alert on structured JSON fields with zero parsing latency.

---

## 12. DevOps, Docker & Production Reliability

### Q23: Why use Multi-Stage Docker builds for Node.js applications?
* **Explanation**:
  * **Stage 1 (Builder)**: Installs all dependencies (including dev tools, TypeScript compiler), compiles `.ts` to `.dist`, runs build scripts.
  * **Stage 2 (Production Runner)**: Copies only compiled `.dist` output and production-only dependencies (`pnpm install --prod`).
  * **Benefits**:
    * Drastically smaller image size (e.g., from ~1GB down to ~150MB).
    * Reduced security attack surface (no source files, no build tooling or dev vulnerabilities in production).
    * Runs under a non-root user (`node` or `pnpm` user) for container security.

### Q24: What is Graceful Shutdown in Node.js and how is it implemented?
* **Explanation**:
  * When a container orchestrator (Kubernetes, Docker) or cloud platform stops a container, it sends a `SIGTERM` or `SIGINT` signal.
  * Instead of abruptly killing ongoing database transactions or active HTTP requests:
    1. Stop accepting new HTTP requests: `server.close()`.
    2. Allow existing in-flight requests to finish (with a timeout).
    3. Close database connection pools (`prisma.$disconnect()`).
    4. Close Redis clients and BullMQ workers.
    5. Exit process cleanly: `process.exit(0)`.

---

*This guide will be updated continuously as we implement each module of CampusHub.*
