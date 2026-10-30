# Both stages use the same immutable base. Updating Node is an explicit change.
ARG NODE_IMAGE=node:26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY scripts/prepare-fonts.mjs ./scripts/prepare-fonts.mjs
RUN npm ci --cache /tmp/npm-cache && rm -rf /tmp/npm-cache \
    && find public/fonts -depth -exec touch -h -d '@0' {} +

FROM dependencies AS build
COPY . .
ARG GIT_SHA=dev
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
RUN npm test && mkdir -p public && DB_PATH=/tmp/wind-build.db NODE_OPTIONS=--max-old-space-size=1024 npm run build
# Keep traced runtime dependencies separate from frequently changing Next output.
# Normalized mtimes also keep this layer identical after a CI cache eviction.
RUN mkdir -p /runtime/dependencies /runtime/app \
    && cp -a .next/standalone/. /runtime/app/ \
    && mv /runtime/app/node_modules /runtime/dependencies/node_modules \
    && cp -a .next/static /runtime/app/.next/static \
    && mkdir -p /runtime/app/src/db /runtime/app/scripts \
    && cp src/db/schema.sql /runtime/app/src/db/schema.sql \
    && cp scripts/reset-password.mjs /runtime/app/scripts/reset-password.mjs \
    && find /runtime/dependencies -depth -exec touch -h -d '@0' {} +

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DB_PATH=/data/wind-blog.db
# One published image, with reusable dependency/font layers and a small app layer.
COPY --link --from=build --chown=1000:1000 /runtime/dependencies/ ./
COPY --link --from=dependencies --chown=1000:1000 /app/public/fonts/ ./public/fonts/
COPY --link --chown=1000:1000 public/ ./public/
COPY --link --from=build --chown=1000:1000 /runtime/app/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
