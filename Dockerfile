# ========================================================
# BACKEND PRODUCTION DOCKERFILE
# Multi-stage build with Debian Bookworm Slim
# ========================================================

# STAGE 1: Build Dependencies
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma/

RUN pnpm --filter backend install --frozen-lockfile

# STAGE 2: TypeScript Compiler / App Builder
FROM node:20-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY --from=deps /app ./
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src/

RUN pnpm --filter backend run prisma:generate
RUN pnpm --filter backend run build
RUN CI=true pnpm --filter backend install --prod --ignore-scripts

# STAGE 3: Production Runner
FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl curl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

USER node

COPY --chown=node:node --from=builder /app/backend/dist ./dist
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node --from=builder /app/backend/prisma ./prisma
COPY --chown=node:node --from=builder /app/backend/package.json ./package.json

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]
