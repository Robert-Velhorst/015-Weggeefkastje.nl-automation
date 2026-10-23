FROM node:26.12.1-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++ \
    && npm install --global npm@12.2.1
COPY package*.json ./
COPY sqlite-build.json ./
COPY scripts/build-stable-sqlite.mjs ./scripts/build-stable-sqlite.mjs
COPY scripts/verify-stable-runtime.mjs ./scripts/verify-stable-runtime.mjs
RUN npm ci --ignore-scripts=false \
    && npm run build:sqlite -- --require-upgrade-baseline
COPY tsconfig*.json vite.config.ts vitest.config.ts eslint.config.js ./
COPY src ./src
COPY web ./web
# Public, origin-restricted browser values; never pass server/provider secrets here.
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAPS_MAP_ID
RUN npm run build && npm prune --omit=dev && node scripts/verify-stable-runtime.mjs

FROM node:26.12.1-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 APP_DATA_DIR=/app/data DATABASE_PATH=/app/data/weggeefkastjes.sqlite WEB_DIST_PATH=/app/dist-web ALLOW_NETWORK_BINDING=true
WORKDIR /app
RUN addgroup -S -g 10001 appuser \
    && adduser -S -D -u 10001 -G appuser appuser \
    && rm -rf /usr/local/lib/node_modules/npm /opt/yarn* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --from=build --chown=appuser:appuser /app/dist-web ./dist-web
COPY --from=build --chown=appuser:appuser /app/package.json ./package.json
COPY --from=build /app/output/sqlite-build-verification.json /usr/share/weggeefkastje/sqlite-build-verification.json
RUN mkdir -p /app/data && chown appuser:appuser /app/data
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "dist/healthcheck.js", "server"]
CMD ["node", "dist/server-main.js"]
