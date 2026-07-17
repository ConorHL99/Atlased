# ─── Build stage: compile React + TypeScript with Vite ───────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src

RUN npm run build
# Output is in /app/dist

# ─── Production stage: Nginx serves the static build ─────────────────────────
FROM nginx:1.27-alpine AS runner

# Copy Vite build output to Nginx's web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace the default Nginx config with ours:
#   - Enables React Router (all paths fall back to index.html)
#   - Sets cache headers for static assets
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The official nginx:alpine image already runs as the 'nginx' user (non-root)
# for worker processes. The master process requires root to bind to port 80,
# which is standard and acceptable inside a container.

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
