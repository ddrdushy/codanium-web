# ─── AI Team Studio — Multi-stage Dockerfile ───
# Optimized for Next.js 16 + Prisma 7.x + PostgreSQL + BullMQ Worker

# ── Stage 1: Dependencies ──────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Generate Prisma Client ────────────────────────────────────────────
FROM deps AS prisma
WORKDIR /app

COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY .env.docker .env
RUN npx prisma generate

# ── Stage 3: Build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/src/generated ./src/generated
COPY . .

# Provide a build-time DATABASE_URL (not used at runtime)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV NEXTAUTH_SECRET="build-time-placeholder"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Bundle standalone worker entrypoint with esbuild (ESM for import.meta support)
# --banner adds a CJS compat shim so externalized packages (bullmq, ioredis)
# that use require() still work in the ESM bundle.
RUN npx esbuild src/lib/queue/worker-entrypoint.ts \
  --bundle \
  --format=esm \
  --platform=node \
  --target=node22 \
  --outfile=worker.mjs \
  --alias:@=./src \
  --banner:js='import { createRequire } from "module"; const require = createRequire(import.meta.url);' \
  --external:@prisma/client \
  --external:@prisma/adapter-pg \
  --external:pg \
  --external:ioredis \
  --external:bullmq \
  --external:@langchain/core \
  --external:@langchain/langgraph \
  --external:bcryptjs \
  --external:next-auth \
  --external:@sendgrid/mail \
  --external:@react-email/components \
  --external:octokit \
  --external:stripe

# ── Stage 4: Production Runner ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl docker-cli
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets — standalone already includes traced node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma generated client (not traced by standalone)
COPY --from=prisma /app/src/generated ./src/generated

# Copy Prisma schema + config for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy bundled worker script (ESM)
COPY --from=builder --chown=nextjs:nodejs /app/worker.mjs ./worker.mjs

# Copy full node_modules from deps stage — the standalone output traces only
# what Next.js needs; the worker's externalized packages (ioredis, bullmq,
# @prisma/adapter-pg, pg, etc.) also need to be available at runtime.
COPY --from=deps /app/node_modules ./node_modules

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
