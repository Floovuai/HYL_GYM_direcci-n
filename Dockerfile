# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4310 \
    DATABASE_PATH=/app/data/hyl_gym.db \
    UPLOAD_DIR=/app/uploads
WORKDIR /app
RUN addgroup -S hyl -g 1001 && adduser -S hyl -G hyl -u 1001
COPY --from=deps --chown=hyl:hyl /app/node_modules ./node_modules
COPY --from=build --chown=hyl:hyl /app/dist ./dist
COPY --from=build --chown=hyl:hyl /app/src ./src
COPY --from=build --chown=hyl:hyl /app/package*.json ./
RUN mkdir -p /app/data /app/uploads && chown -R hyl:hyl /app/data /app/uploads
USER hyl
EXPOSE 4310
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4310) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "start:container"]
