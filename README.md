# CampusHub API 🎓🚀

Enterprise-grade Campus Community & Event Ticketing Backend built with Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Redis, and Docker.

[![CI/CD Pipeline](https://github.com/sanjeevirajanramajayam/campusHubAPI/actions/workflows/ci.yml/badge.svg)](https://github.com/sanjeevirajanramajayam/campusHubAPI/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-20.x-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)

---

## 🏗️ Architecture & Core Features

* **Multi-Stage Containerization**: Lean Debian Bookworm Slim Docker image with zero dynamic linker faults and non-root security.
* **ACID Concurrency Engine**: Guaranteed zero-overselling event ticketing using atomic PostgreSQL row-level locks (`SELECT ... FOR UPDATE`).
* **Authentication & RBAC**: Dual-token authentication (Access JWT + Refresh Token Rotation with automatic token-family reuse revocation detection).
* **High-Performance Cryptography**: RFC 9106 Argon2id password hashing powered by Rust N-API (`@node-rs/argon2`).
* **Distributed Locking & Caching**: Redis-backed idempotent request middleware, token revocation blacklist, and rate-limiting.
* **Gated CI/CD Pipeline**: 3-job automated pipeline enforcing Prettier, ESLint, TypeScript Typechecking, PostgreSQL/Redis service containers, and Vitest V8 code coverage before triggering zero-downtime production deployment.

---

## 🧪 Testing Suite

```bash
# Run all unit tests with code coverage thresholds
pnpm test:unit

# Run Supertest integration tests against PostgreSQL & Redis
pnpm test:integration

# Run high-concurrency race condition tests (20 simultaneous students vs 5 seats)
pnpm test:concurrency

# Run security tampering & header checks
pnpm test:security

# Generate full V8 HTML/LCOV code coverage report
pnpm test:coverage
```

---

## 🚀 Deployment

Automated via GitHub Actions with Render Webhook Deploy Hook:
* **Quality Check**: Dependency audit, linting, typecheck, database migration, and test coverage.
* **Docker Build**: Verifies production multi-stage container build with layer caching.
* **Production Deploy**: Automatically triggers zero-downtime Render deployment only when 100% of checks pass.
