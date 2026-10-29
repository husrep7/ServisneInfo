# Build iz roota repoa (monorepo lockfile):
#   docker build -f apps/backend/Dockerfile -t servisneinfo-backend .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm workspaces traže package.json svih workspace-ova iz lockfilea
COPY apps/backend/package.json apps/backend/
COPY apps/mobile/package.json apps/mobile/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w apps/backend --include-workspace-root=false
# Zajednički tipovi (@servisneinfo/shared) trebaju samo za tsc build
COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN npm run build -w apps/backend \
 && cp -r apps/backend/src/db/migrations apps/backend/dist/db/migrations

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/mobile/package.json apps/mobile/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w apps/backend --include-workspace-root=false --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./dist
COPY apps/backend/package.json ./
USER node
EXPOSE 3000
# Migracije su idempotentne (schema_migrations) — sigurno ih je pokretati pri svakom startu
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
