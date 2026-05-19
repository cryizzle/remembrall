FROM node:22-bookworm-slim AS base

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 8989

CMD ["sh", "-c", "npx prisma db push && npm start"]
