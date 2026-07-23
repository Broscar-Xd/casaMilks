FROM node:20-alpine AS builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci

COPY backend/ .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY backend/prisma ./prisma

RUN npm ci --production

EXPOSE 3000

CMD npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts && node dist/index.js
