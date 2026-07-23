FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

# Build backend
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --ignore-scripts && npx prisma generate

COPY backend/ .
RUN npm run build

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Production image
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/frontend/dist ./public

RUN npm install -g tsx

EXPOSE 3000

CMD npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts && node dist/index.js
