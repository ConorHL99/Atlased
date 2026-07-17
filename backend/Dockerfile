# ─── Build stage: compile TypeScript ─────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Install all dependencies (devDeps needed for tsc and prisma generate)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema before generate so the client is built for the right schema
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Install production dependencies and regenerate Prisma client
# (copying node_modules from builder would include devDeps; this is cleaner)
COPY package*.json ./
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm ci --omit=dev && npx prisma generate

# Copy compiled application from build stage
COPY --from=builder /app/dist ./dist

# Transfer ownership to the built-in non-root 'node' user, then switch.
# Running as non-root reduces the blast radius of any container escape.
RUN chown -R node:node /app
USER node

EXPOSE 4000

# Run pending migrations (idempotent) then start the server.
# `migrate deploy` is safe for production — it only applies new migrations.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
