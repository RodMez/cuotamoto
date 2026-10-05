FROM node:20-slim AS base
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public
VOLUME ["/app/data"]
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 DATABASE_URL=file:/app/data/prod.db
CMD ["node", "server.js"]
