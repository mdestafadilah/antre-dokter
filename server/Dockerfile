# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package.json bun.lock ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

# Install all dependencies (workspace-aware)
RUN bun install --frozen-lockfile

# Copy source files
COPY shared/ ./shared/
COPY server/ ./server/

# Build the server
WORKDIR /app/server
RUN bun run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS production

WORKDIR /app

# Install sequelize-cli for migrations
RUN bun add -g sequelize-cli

# Copy root workspace files
COPY package.json bun.lock ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy shared workspace source
COPY shared/ ./shared/

# Copy built server output
COPY --from=builder /app/server/dist ./server/dist

# Copy migration and config files (needed by sequelize-cli)
COPY server/migrations ./server/migrations
COPY server/seeders ./server/seeders
COPY server/.sequelizerc ./server/.sequelizerc
COPY server/src/config ./server/src/config

# Copy entrypoint script
COPY server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

WORKDIR /app/server

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "run", "dist/index.js"]
