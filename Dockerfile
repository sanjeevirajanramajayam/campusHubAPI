# ========================================================
# STAGE 1: Install Dependencies (Layer Caching Optimization)
# Using Debian Bookworm Slim for native GNU glibc compatibility (zero SIGSEGV)
# ========================================================
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Enable pnpm via Corepack matching workspace package manager
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Copy only dependency manifests to maximize Docker build layer cache
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies (argon2 uses precompiled glibc Linux binaries natively)
RUN pnpm install --frozen-lockfile

# ========================================================
# STAGE 2: Build & Compile TypeScript
# ========================================================
FROM node:20-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Generate Prisma Client bindings for Linux Debian architecture
RUN pnpm prisma generate

# Compile TypeScript into production JavaScript (dist/)
RUN pnpm build

# Prune devDependencies to keep final image footprint small
RUN pnpm prune --prod

# ========================================================
# STAGE 3: Lean Production Runner
# ========================================================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install openssl and curl for Prisma query engine and container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Security: Run as unprivileged non-root user (node UID 1000)
USER node

# Copy only compiled code and production dependencies
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/package.json ./package.json

EXPOSE 5000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Launch compiled production server
CMD ["node", "dist/server.js"]
