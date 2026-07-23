FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --ignore-scripts && npx prisma generate

COPY backend/ .
RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

RUN npm install -g tsx

EXPOSE 3000

CMD npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts && node dist/index.js
