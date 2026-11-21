# Stage 1: Build production static assets
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies deterministically
COPY package.json package-lock.json ./
RUN npm ci

# Copy strictly the web application sources required for the production build
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public/ ./public/
COPY src/ ./src/

RUN npm run build

# Stage 2: Serve with non-root, least-privilege Nginx
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

# Remove default static assets and install custom Nginx configuration
USER root
RUN rm -rf /usr/share/nginx/html/*
COPY --chown=101:101 --from=builder /app/dist /usr/share/nginx/html
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Drop back to unprivileged nginx user (UID 101)
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
