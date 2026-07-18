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
RUN npm run build && npm prune --omit=dev

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Reuse builder artifacts to avoid a second dependency install on slower hosts.
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Copy compiled application from build stage
COPY --from=builder /app/dist ./dist

# Transfer ownership to the built-in non-root 'node' user, then switch.
# Running as non-root reduces the blast radius of any container escape.
RUN chown -R node:node /app
USER node

EXPOSE 4000

# Run migrations when present; if none exist yet, fall back to db push once.
# This keeps first-time deployments working before migration files are committed.
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push; node dist/index.js"]
