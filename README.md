# remembrall

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
