# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.17.0
FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci --no-audit --no-fund \
  && npm rebuild better-sqlite3 --build-from-source

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummies solo para que `next build` nunca toque la DB real (ver src/server/db/index.ts)
ENV DATABASE_URL=file:/tmp/build.db
ENV AUTH_SECRET=dummy_secret_32_chars_long_xxxxxxxxxxxxxxxxxxxxxxxx
ENV AUTH_URL=http://localhost:3000
ENV ADMIN_EMAIL=admin@cuotamoto.local
ENV ADMIN_PASSWORD=dummy-admin-password
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/app/data/prod.db
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV TZ=America/Bogota

RUN mkdir -p /app/data /app/scripts && chown nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

VOLUME /app/data
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
