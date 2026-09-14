# ========================================================
# NEXT.JS 16 STANDALONE PRODUCTION DOCKERFILE
# ========================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/

RUN pnpm --filter frontend install --frozen-lockfile

# ========================================================
# STAGE 2: Builder
# ========================================================
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY --from=deps /app ./
COPY frontend ./frontend

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter frontend build

# ========================================================
# STAGE 3: Production Runner
# ========================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy public static files and standalone build output
COPY --from=builder /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "frontend/server.js"]
