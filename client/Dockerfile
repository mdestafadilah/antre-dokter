# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS builder

# Accept build-time variable for API URL
ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copy workspace root package files
COPY package.json bun.lock ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/

# Install all dependencies (workspace-aware)
RUN bun install --frozen-lockfile

# Copy source files
COPY shared/ ./shared/
COPY client/ ./client/

# Build the Vite app
WORKDIR /app/client
RUN bun run build

# ─── Stage 2: Serve with Nginx ────────────────────────────────────────────────
FROM nginx:stable-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder
COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
