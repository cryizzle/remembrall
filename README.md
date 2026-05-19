# remembrall

<p align="center">
  <img src="assets/remembrall_welcome.png" alt="Remembrall welcome screen" width="480">
</p>

A Telegram-first reminder bot. Send it a message in plain English ("remind me to bring my charger tomorrow at 8am") and it turns that into a structured reminder you can manage from the chat.

## Stack

- Node.js + TypeScript
- Fastify
- Prisma + Postgres
- Poolside for natural-language parsing
- Telegram Bot API

## Setup

1. Copy the env template and fill in your secrets:

   ```bash
   cp .env.example .env
   ```

   You'll need a `POOLSIDE_API_KEY` and a `TELEGRAM_BOT_TOKEN` (plus a `TELEGRAM_WEBHOOK_SECRET` of your choosing).

2. Start the stack:

   ```bash
   docker compose up
   ```

   The API listens on `http://localhost:8989` and Prisma applies the schema on boot.

3. Point Telegram at your webhook (use a tunnel like ngrok for local dev):

   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://your-domain.example/telegram/webhook",
       "secret_token": "your-webhook-secret"
     }'
   ```

   The `secret_token` must match `TELEGRAM_WEBHOOK_SECRET` so the app can verify incoming updates.

That's it — message your bot to start creating reminders.

## Production (home server)

The repo ships with two compose files: `docker-compose.yml` (prod-shaped, uses the bundled `Dockerfile`) and `docker-compose.override.yml` (dev-only, restores the bind-mount + `tsx watch` workflow). `docker compose up` merges both automatically, so local dev keeps working as above. On the server, pass `-f docker-compose.yml` to skip the override.

1. Generate a strong `POSTGRES_PASSWORD` and add it (plus all the other secrets) to `.env` on the server. Don't forget to update `DATABASE_URL` to use the same password.

   ```bash
   openssl rand -base64 48 | tr -d '/+=\n' | head -c 32
   ```

2. Build and run the prod stack:

   ```bash
   docker compose -f docker-compose.yml up -d --build
   ```

   Prisma migrations apply automatically at container start. The API binds to `127.0.0.1:8989` — put a reverse proxy or tunnel (Caddy, Cloudflare Tunnel, …) in front to terminate TLS and expose it publicly.

3. Register the Telegram webhook against your public URL with a production `TELEGRAM_WEBHOOK_SECRET`:

   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://your-domain.example/telegram/webhook",
       "secret_token": "your-webhook-secret"
     }'
   ```

