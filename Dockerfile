FROM node:26-bookworm-slim AS build
ARG GIT_SHA=dev
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY scripts/prepare-fonts.mjs ./scripts/prepare-fonts.mjs
RUN npm ci --cache /tmp/npm-cache && rm -rf /tmp/npm-cache
COPY . .
RUN npm test && mkdir -p public && DB_PATH=/tmp/wind-build.db NODE_OPTIONS=--max-old-space-size=1024 npm run build

FROM node:26-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DB_PATH=/data/wind-blog.db
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src/db/schema.sql ./src/db/schema.sql
COPY --chown=node:node scripts/reset-password.mjs ./scripts/reset-password.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
