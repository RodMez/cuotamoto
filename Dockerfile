FROM node:20.18-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
RUN npm rebuild better-sqlite3 --build-from-source
COPY . .
RUN npm run build

FROM node:20.18-bookworm-slim AS runner
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000 HOSTNAME=0.0.0.0 DATABASE_URL=file:/app/data/prod.db
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/scripts ./scripts
COPY --from=base /app/node_modules ./node_modules
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "scripts/migrate-and-start.mjs"]
