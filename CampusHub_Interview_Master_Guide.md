# CampusHub Backend: Master Interview Guide (Current State: Phase 1)

> **Current Phase**: Foundation, Tooling, Environment & Base Express Server  
> This guide is an exhaustive, real-world interview preparation manual for the **exact tools, concepts, files, and configurations currently active in our codebase**.

---

## Table of Contents
1. [Package Management: pnpm, Dependencies & Node Ecosystem](#1-package-management-pnpm-dependencies--node-ecosystem)
2. [Runtime Validation: Zod & Environment Variables](#2-runtime-validation-zod--environment-variables)
3. [TypeScript Compiler & Node.js ESM Internals](#3-typescript-compiler--nodejs-esm-internals)
4. [Structured Logging: Pino vs Legacy Approaches](#4-structured-logging-pino-vs-legacy-approaches)
5. [Error Architecture & Exception Hierarchy: AppError](#5-error-architecture--exception-hierarchy-apperror)
6. [Express Middleware Pipeline, Security & HTTP Standards](#6-express-middleware-pipeline-security--http-standards)
7. [Process Lifecycle, Signals & Graceful Shutdown](#7-process-lifecycle-signals--graceful-shutdown)
8. [Database Fundamentals, ORMs & Prisma](#8-database-fundamentals-orms--prisma)

---

## 1. Package Management: pnpm, Dependencies & Node Ecosystem

### Q1: Why did we choose `pnpm` over `npm` or `Yarn`? What are "Phantom Dependencies"?
* **Content-Addressable Global Store**: `pnpm` downloads every package version exactly once globally (`~/.pnpm-store`). Inside our project, it creates **hard links** directly to that store, saving gigabytes of disk space.
* **Phantom Dependencies**:
  * `npm` flattens the `node_modules` tree via hoisting. If package `A` depends on package `B`, `npm` puts `B` in the root `node_modules`.
  * Your code could accidentally do `import B from 'B'` without declaring `B` in `package.json`. If package `A` updates and drops `B`, your app crashes in production.
  * `pnpm` builds a **nested, non-flat symlink structure**. Only packages explicitly declared in `package.json` can be imported by your code.

### Q2: What is the difference between a Hard Link and a Soft Link (Symlink), and how does `pnpm` use both?
* **Hard Link**: A direct pointer to the physical data (inode) on disk. Multiple hard links point to the same physical file. Even if one link is deleted, the data remains accessible through the other. `pnpm` uses hard links from the global store into the project's hidden `.pnpm/` folder.
* **Soft Link (Symlink)**: A small shortcut file containing the path to another file/directory. `pnpm` uses symlinks from `node_modules/<pkg>` pointing into `.pnpm/<pkg>@version/node_modules/<pkg>` to create the isolated package structure.

### Q3: What is the purpose of `pnpm-lock.yaml` (or `package-lock.json`), and why must it always be committed to Git?
* **Purpose**: `package.json` only specifies version ranges (e.g. `^5.2.1`). The lockfile records the **exact resolved version, download URL, and cryptographic integrity hash (SHA-512)** of every single package and sub-dependency.
* **Why commit it**: Guarantees **deterministic builds**. Without a lockfile, running `pnpm install` in CI/CD or production might resolve a newly published minor/patch version that contains breaking bugs or security vulnerabilities.

### Q4: What is the difference between `dependencies` and `devDependencies`? How does `pnpm install --prod` work in production?
* **`dependencies`**: Packages required for the application to run in production (e.g., `express`, `zod`, `pino`, `dotenv`, `cors`, `helmet`).
* **`devDependencies`**: Packages only needed during development and build time (e.g., `typescript`, `@types/express`, `tsx`, `rimraf`).
* **In Production**: We run `pnpm install --prod` (or `pnpm prune --prod`), which completely skips installing dev dependencies. This reduces Docker container image sizes from ~1GB to ~150MB and minimizes security attack surfaces.

### Q5: What do Semantic Versioning symbols (`^` caret vs `~` tilde vs exact version) mean in `package.json`?
* Given version `MAJOR.MINOR.PATCH` (e.g. `1.2.3`):
  * **`~1.2.3` (Tilde)**: Accepts only **PATCH** updates (`>=1.2.3 <1.3.0`). Safest for bugfixes.
  * **`^1.2.3` (Caret - Default)**: Accepts **MINOR and PATCH** updates (`>=1.2.3 <2.0.0`). Assumes backwards-compatible features.
  * **`1.2.3` (Exact)**: Pins the package to that exact version. No automatic upgrades.

---

## 2. Runtime Validation: Zod & Environment Variables

### Q6: Why can't TypeScript interfaces validate environment variables or request bodies at runtime? (Type Erasure)
* **Explanation**:
  * TypeScript types and interfaces only exist at **compile time**.
  * When `tsc` compiles TypeScript to JavaScript, **all types, interfaces, and type annotations are completely erased** (Type Erasure). The resulting JavaScript has zero type knowledge.
  * Therefore, TypeScript cannot check if `process.env.JWT_SECRET` actually exists when Node.js runs. **Zod provides runtime schema validation** that executes in JavaScript at runtime.

### Q7: Why use Zod to validate environment variables instead of accessing `process.env` directly? (The Fail-Fast Principle)
* **Problem with raw `process.env`**: `process.env` is an untyped object where every key is `string | undefined`. If `JWT_ACCESS_SECRET` is missing, the server starts without error. Days later, when a user registers, the server crashes mid-request.
* **Fail-Fast Principle**: With `envSchema.safeParse(process.env)`, if any variable is missing, malformed, or invalid (e.g. secret `< 32 chars`), the server refuses to start and calls `process.exit(1)` immediately with an exact error report.

### Q8: What is the difference between `.parse()` and `.safeParse()` in Zod?
* **`.parse(data)`**: Validates the data. If valid, returns the parsed data. If invalid, **throws a `ZodError` exception** that must be caught with `try/catch`.
* **`.safeParse(data)`**: Validates the data without throwing. Returns a discriminated union object:
  * `{ success: true, data: T }` on success.
  * `{ success: false, error: ZodError }` on failure.
  * *Why we use it in `env.ts`*: It allows us to format and log clean error messages before exiting without dumping an ugly unhandled exception stack trace.

### Q9: Why did we use `z.coerce.number()` for `PORT` instead of `z.number()`?
* In Node.js, **all values in `process.env` are strings** (e.g., `process.env.PORT` returns `"5000"`, not `5000`).
* `z.number()` checks if `typeof val === 'number'`, which fails for `"5000"` with `"Expected number, received string"`.
* `z.coerce.number()` runs `Number(val)` first, converting `"5000"` into `5000` before validating.

### Q10: How does `z.infer<typeof schema>` work under the hood in TypeScript?
* `z.infer` uses TypeScript's **conditional types** and the `infer` keyword to inspect the Zod schema object and automatically generate the matching static TypeScript type.
* **Benefit**: Single source of truth. Updating the validation rules automatically updates the TypeScript types across the entire project with zero code duplication.

---

## 3. TypeScript Compiler & Node.js ESM Internals

### Q11: What does `"type": "module"` in `package.json` mean? How does ECMAScript Modules (ESM) differ from CommonJS (CJS)?
* `"type": "module"` tells Node.js to treat all `.js` files as **ECMAScript Modules (ESM)** by default (`import`/`export` syntax) rather than CommonJS (`require`/`module.exports`).
* **Key Differences**:
  * **Loading**: ESM imports are static and parsed asynchronously before code execution. CommonJS `require()` is dynamic and synchronous (blocks the event loop during loading).
  * **Top-Level Await**: ESM natively supports `await` at the top level outside of `async` functions; CommonJS does not.
  * **Globals**: In ESM, `__dirname` and `__filename` do not exist by default (replaced by `import.meta.url`).

### Q12: What do `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` do in `tsconfig.json`?
* They configure TypeScript to match Node's modern native ESM resolution rules:
  * Enforces specifying file extensions in relative imports (e.g., `import { env } from './config/env.js'`).
  * Respects conditional `"exports"` in dependencies' `package.json`.
  * Enables seamless interoperability between ESM modules and CommonJS dependencies.

### Q13: Why enable `"strict": true`, `"sourceMap": true`, and `"skipLibCheck": true` in `tsconfig.json`?
* **`"strict": true`**: Turns on the full suite of strict type checking (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`). Prevents `Cannot read properties of undefined` runtime crashes.
* **`"sourceMap": true`**: Emits `.js.map` files mapping compiled JavaScript back to original TypeScript lines, ensuring stack traces and debuggers point to the exact `.ts` source code line.
* **`"skipLibCheck": true`**: Skips type checking of all `.d.ts` files inside `node_modules`. Significantly speeds up compilation time while still checking your application's source code.

### Q14: What is `tsx` vs `ts-node` vs `tsc`? Why use `tsx` for local development?
* **`tsc`**: The official TypeScript compiler. Performs full type-checking and outputs JavaScript files to `dist/`. Slow for instant dev iteration.
* **`ts-node`**: Legacy tool that runs TypeScript in-memory using `tsc`. Can be slow on large projects.
* **`tsx`**: Modern, blazing-fast TypeScript runner powered by **`esbuild`**. It strips types and executes TypeScript files directly with near-instant startup time and native watch mode (`tsx watch src/server.ts`).

---

## 4. Structured Logging: Pino vs Legacy Approaches

### Q15: Why is `console.log()` an anti-pattern in production backend services? Why use Pino?
1. **Event Loop Blocking**: `console.log` writes synchronously to `process.stdout` in certain terminal streams. Under high traffic, large strings can block the single-threaded Node.js event loop.
2. **Unstructured Output**: `console.log("User logged in: " + id)` outputs raw plain text. Log management platforms (Datadog, CloudWatch, Grafana Loki) cannot easily index or query text strings.
3. **Pino's Advantages**:
   * Emits structured JSON: `{"level":"info","time":1698234,"method":"GET","url":"/health","durationMs":2}`.
   * Log aggregators can query JSON fields directly (`SELECT * WHERE durationMs > 500`).
   * 5x–10x faster with minimal CPU/memory overhead compared to Winston.
   * Uses `pino-pretty` exclusively in development for human-readable colored output.

---

## 5. Error Architecture & Exception Hierarchy: AppError

### Q16: Why create a custom `AppError` class extending `Error`? What is the purpose of `isOperational`?
* Standard JavaScript `Error` only contains `message` and `name`.
* `AppError` adds HTTP semantics:
  * `statusCode`: HTTP code (400, 401, 403, 404, 409, 422, 500).
  * `code`: Machine-readable error identifier (`'VALIDATION_ERROR'`, `'USER_NOT_FOUND'`).
  * `details`: Field-specific error details (e.g. Zod validation arrays).
* **Operational vs Programmer Errors (`isOperational: boolean`)**:
  * **Operational Errors (`true`)**: Expected, client-induced errors (invalid credentials, missing fields). Safe to return to the client with a 4xx status.
  * **Programmer Errors (`false`/unhandled)**: Bugs (null pointer references, syntax errors, DB connection loss). The server logs the full error stack trace for developers and returns a generic `500 Internal Server Error` to prevent leaking internal database queries or server paths to attackers.

### Q17: What does `Error.captureStackTrace(this, this.constructor)` do?
* When a class extends `Error`, the stack trace by default includes the constructor call of `AppError`.
* `Error.captureStackTrace` excludes the constructor itself from the trace, ensuring the stack trace starts cleanly at the exact line where `new AppError()` was invoked.

---

## 6. Express Middleware Pipeline, Security & HTTP Standards

### Q18: How does the Express middleware pipeline work, and why does middleware registration order matter?
* Express processes requests through a linear chain of functions: `(req, res, next) => void`.
* Each middleware either modifies `req`/`res` and calls `next()`, or terminates the request by sending a response (`res.json()`).
* **Order of Execution**:
  1. Security (`helmet()`) and CORS (`cors()`) must be first so all responses include security headers.
  2. Body Parsers (`express.json()`) must run before route handlers so `req.body` is parsed.
  3. Request loggers run to record timings.
  4. Feature routes execute.
  5. 404 Catch-all handler runs for unmatched routes.
  6. **Error Handler must be registered DEAD LAST** to catch errors from all upstream handlers.

### Q19: How does Express recognize an Error-Handling Middleware?
* Express checks the **function arity (`fn.length`)**.
* Normal middleware has 3 parameters: `(req, res, next)`.
* Error-handling middleware **must declare exactly 4 parameters**: `(err, req, res, next)`.
* If you omit `next`, `fn.length` becomes 3, and Express will treat it as a standard route middleware, completely ignoring it when an error is thrown.

### Q20: What do Helmet and CORS do at the HTTP level?
* **Helmet**: Sets essential security response headers to secure Express applications from common web vulnerabilities.
* **CORS (Cross-Origin Resource Sharing)**:
  * Browsers block frontend clients (e.g. `http://localhost:3000`) from reading responses from a different backend origin (`http://localhost:5000`).
  * `cors()` middleware handles browser preflight `OPTIONS` requests and sends `Access-Control-Allow-Origin` headers.

### Q21: Why Helmet Matters: What are the key headers set by Helmet and what attacks do they mitigate?
* **1. Blocks XSS Attacks (`Content-Security-Policy`)**:
  * Adds the `Content-Security-Policy` (CSP) header which restricts where scripts, styles, and images can be loaded from. This mitigates a large number of injection attacks like Cross-Site Scripting (XSS).
* **2. Prevents Clickjacking (`X-Frame-Options`)**:
  * Adds `X-Frame-Options: SAMEORIGIN` so malicious external websites cannot trap or embed your application inside a hidden or transparent `<iframe>` overlay to hijack user clicks.
* **3. Hides Server Details (`Hide X-Powered-By`)**:
  * Removes the default `X-Powered-By: Express` header to stop attackers from fingerprinting that the backend runs on Express/Node.js and scanning for framework-specific CVE vulnerabilities.
* **4. Stops MIME Sniffing (`X-Content-Type-Options`)**:
  * Sets `X-Content-Type-Options: nosniff` so browsers strictly follow the server's declared `Content-Type` instead of guessing or executing arbitrary uploaded files (e.g. executing a `.txt` as `.js`).
* **5. Enforces HTTPS (`Strict-Transport-Security` / HSTS)**:
  * Adds the HSTS header to force all future browser connections to use encrypted HTTPS, preventing SSL-stripping and Man-in-the-Middle (MITM) attacks.

### Q22: When does Helmet need custom configuration in real-world production backends?
* **When serving Swagger/OpenAPI Docs (`/api-docs`)**: Default CSP blocks inline CSS/JS used by Swagger UI.
* **When loading assets from S3 / Cloudinary**: Default `Cross-Origin-Resource-Policy (CORP)` and `imgSrc` CSP will block cross-origin images unless configured with `crossOriginResourcePolicy: { policy: "cross-origin" }`.

### Q23: Does using Helmet make an Express application completely secure?
* **No**. Helmet only instructs the browser how to behave via HTTP headers. It cannot protect against SQL Injection (mitigated by Prisma/parameterized queries), Broken Access Control / IDOR, Rate Limiting / DDoS, or business logic flaws.

### Q24: Why pass `{ limit: '1mb' }` to `express.json()`?
* **Denial of Service (DoS) Prevention**: If a malicious client sends a 500MB JSON payload in a `POST` request, the server will attempt to buffer and parse the entire string in memory, exhausting RAM and locking the event loop. Setting a 1MB limit immediately rejects oversized payloads with `HTTP 413 Payload Too Large`.

### Q25: What is the semantic difference between HTTP Status Codes: 400, 401, 403, 404, 409, 422, and 500?
* **400 Bad Request**: General client error (malformed JSON syntax, invalid query parameter).
* **401 Unauthorized**: Missing or invalid authentication (not logged in / invalid token). *"Who are you?"*
* **403 Forbidden**: Authenticated, but lacking permission for this resource (e.g., student trying to access admin dashboard). *"You are not allowed here."*
* **404 Not Found**: The requested URL or entity does not exist.
* **409 Conflict**: Request conflicts with current database state (e.g., registering with an email that already exists).
* **422 Unprocessable Entity**: The JSON syntax is valid, but fails business/schema validation rules (e.g., password `< 8` chars).
* **500 Internal Server Error**: Unexpected server crash or unhandled exception.

---

## 7. Process Lifecycle, Signals & Graceful Shutdown

### Q26: What is "Graceful Shutdown" in Node.js and why is it mandatory in containerized environments?
* When Docker, Kubernetes, or AWS stops a container, it sends an OS signal: `SIGTERM` (terminate) or `SIGINT` (Ctrl+C).
* **Without Graceful Shutdown**: The process dies instantly. Ongoing database writes are corrupted, active file uploads break, and connected users receive network drops.
* **With Graceful Shutdown (`server.close()`)**:
  1. `server.close()` stops accepting new incoming HTTP connections.
  2. In-flight requests are given time to complete cleanly.
  3. Database connection pools and cache clients are closed.
  4. Process exits with `process.exit(0)`.
  5. A 10-second timeout ensures the process exits forcefully if a connection hangs.

### Q27: What is the difference between `SIGTERM` and `SIGKILL`?
* **`SIGTERM` (Signal 15)**: A graceful termination signal sent to a process. The process can listen to it (`process.on('SIGTERM')`), execute cleanup code, and shut down cleanly.
* **`SIGKILL` (Signal 9)**: An immediate kill signal executed directly by the OS kernel. It **cannot be intercepted, caught, or ignored** by the process. If a process does not exit after receiving `SIGTERM` within a grace period (e.g. 30s), orchestrators send `SIGKILL`.

### Q28: What is the difference between `uncaughtException` and `unhandledRejection`?
* **`uncaughtException`**: Triggered when a synchronous JavaScript exception is thrown outside of any `try/catch`. The process state is considered corrupted, so the logger records the error and the process must terminate (`process.exit(1)`).
* **`unhandledRejection`**: Triggered when a `Promise` is rejected (e.g., an `async` database query error) without a `.catch()` block or `try/catch` handler.

### Q29: Why use `process.exit(1)` on error instead of `process.exit(0)`?
* In UNIX operating systems and CI/CD pipelines:
  * **Exit Code `0`**: Indicates success. Container orchestrators and CI/CD tools treat `0` as a normal, expected completion.
  * **Exit Code `1` (or non-zero)**: Indicates failure/crash. Container orchestrators (Docker, Kubernetes) recognize non-zero exit codes and automatically trigger container restart policies or fail CI/CD deployments.

---

## 8. Database Fundamentals, ORMs & Prisma

### Q30: What is an ORM (Object-Relational Mapping) and what is the "Object-Relational Impedance Mismatch"?
* **The Impedance Mismatch Problem**:
  * Relational databases store data in **flat tabular rows and columns** joined by foreign keys (`user_id = 42`).
  * TypeScript/Node.js code processes data in **nested objects, classes, and arrays** (`post.author.email`).
* **Role of the ORM**:
  * An ORM is the software bridge that translates database rows into typed TypeScript objects, and translates TypeScript function calls (`prisma.user.findUnique(...)`) into optimized SQL queries.

### Q31: How do ORMs prevent SQL Injection 100%? (AST Compilation vs String Concatenation)
* **Vulnerable String Concatenation**:
  * Query: `"SELECT * FROM users WHERE email = '" + input + "'"`
  * If input is `' OR '1'='1`, the SQL parser executes boolean operations and dumps the table.
* **Secure Parameterized Queries (How ORMs work)**:
  * Query: `SELECT * FROM users WHERE email = $1`, Parameters: `["' OR '1'='1"]`
  * The PostgreSQL parser compiles the **Abstract Syntax Tree (AST)** *first*. The database engine knows `$1` is strictly literal text data, meaning user inputs can never be interpreted as executable SQL commands.

### Q32: Compare the 3 Database Access Paradigms in Node.js: Active Record, Query Builders, and Schema-First Data Mappers.
* **1. Active Record (TypeORM / Sequelize)**:
  * Models are classes with active methods (`user.save()`, `user.remove()`).
  * *Downside*: Tightly couples domain entities with database persistence concerns.
* **2. Query Builders (Knex / Kysely / Drizzle)**:
  * Programmatic SQL builders (`db.select().from('users').where(...)`).
  * *Upside*: Ultra-fast and lightweight; close to raw SQL.
  * *Downside*: Requires manual schema synchronization without automated schema DSLs.
* **3. Schema-First Data Mappers (Prisma - Our Choice)**:
  * Declarative single source of truth (`prisma/schema.prisma`).
  * Generates an end-to-end type-safe client tailored specifically to your schema.
  * Clean separation: Services do not need to know database table schemas directly.

### Q33: Why did we choose Prisma for CampusHub?
* **End-to-End Type Safety**: If you rename a database column in `schema.prisma`, running `prisma generate` immediately causes TypeScript to flag every affected file in your codebase at compile time.
* **Automated, Version-Controlled Migrations**: `prisma migrate dev` generates timestamped `.sql` files committed to Git, guaranteeing schema consistency across local dev, CI/CD, and production.
* **Declarative Nested Relations**: Simplifies multi-table queries (`include: { events: true, members: { include: { user: true } } }`) without writing brittle raw SQL `JOIN` statements.

### Q34: What are the trade-offs, pitfalls, and limitations of ORMs?
* **1. The N+1 Query Problem**: Executing database queries in a loop rather than using `include`, `select`, or batching (`WHERE id IN (...)`).
* **2. Complex Analytical Queries**: For large-scale reporting with window functions, recursive CTEs, or geospatial calculations, ORMs can generate heavy SQL. *(Prisma provides `prisma.$queryRaw` for writing optimized raw SQL when needed)*.
* **3. Memory Overhead**: Mapping thousands of database rows into JavaScript objects consumes more memory than streaming raw byte buffers.
