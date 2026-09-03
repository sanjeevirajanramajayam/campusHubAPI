# ========================================================
# STAGE 1: Install Dependencies (Layer Caching Optimization)
# ========================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable pnpm via Corepack matching workspace package manager
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Copy only dependency manifests to maximize Docker build layer cache
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies required for tsc compilation)
RUN pnpm install --frozen-lockfile

# ========================================================
# STAGE 2: Build & Compile TypeScript
# ========================================================
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Generate Prisma Client bindings for the Linux container architecture
RUN pnpm prisma generate

# Compile TypeScript into production JavaScript (dist/)
RUN pnpm build

# Prune devDependencies to keep final image footprint small
RUN pnpm prune --prod

# ========================================================
# STAGE 3: Lean Production Runner
# ========================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Security: Run as unprivileged non-root user (UID 1000)
USER node

# Copy only compiled code and production dependencies
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/package.json ./package.json

EXPOSE 5000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Launch compiled production server
CMD ["node", "dist/server.js"]
