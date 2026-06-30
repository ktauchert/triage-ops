FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate -w @gridnull/db
RUN npm run build -w @gridnull/db
RUN npm run build -w @gridnull/worker

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/package.json ./package.json
COPY --from=builder --chown=worker:nodejs /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=worker:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=worker:nodejs /app/packages/shared-types ./packages/shared-types
USER worker
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "process.exit(0)"
CMD ["node", "apps/worker/dist/index.js"]
