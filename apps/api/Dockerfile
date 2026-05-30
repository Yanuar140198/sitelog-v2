# Multi-stage Dockerfile for @sitelog/api — Bun runtime, Alpine base.
# Build:  docker build -t sitelog-api -f apps/api/Dockerfile .
# Run:    docker run -p 4000:4000 -e DATABASE_URL=... -e BETTER_AUTH_SECRET=... sitelog-api

# Single build stage with the full source tree so workspace packages
# (@sitelog/db etc.) resolve during bun install + the bundle step.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY . .
RUN bun install
RUN cd apps/api && bun build src/server.ts --target=bun --outdir=dist

FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1001 sitelog && adduser -D -u 1001 -G sitelog sitelog
COPY --from=build --chown=sitelog:sitelog /app/apps/api/dist ./dist
COPY --from=build --chown=sitelog:sitelog /app/node_modules ./node_modules
COPY --from=build --chown=sitelog:sitelog /app/packages ./packages
USER sitelog
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/healthz | grep -q ok || exit 1
CMD ["bun", "dist/server.js"]
