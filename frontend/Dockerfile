# Build the Vite app with the Node version supported by Vite 8.
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Vite embeds these values into the static bundle at build time.
ARG VITE_USER_SERVICE_URL=http://localhost:5173
ARG VITE_TICKETING_SERVICE_URL=http://localhost:5173
ENV VITE_USER_SERVICE_URL=${VITE_USER_SERVICE_URL}
ENV VITE_TICKETING_SERVICE_URL=${VITE_TICKETING_SERVICE_URL}

RUN npm run build

# Serve the static app as an unprivileged Nginx process.
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

