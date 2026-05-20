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

The prod compose file pulls a pre-built image from GitHub Container Registry, so you can deploy without cloning the repo if you prefer.

**Option A: Clone repo** (simplest for iterative updates):
```bash
git clone git@github.com:cryizzle/remembrall.git
cd remembrall
cp .env.example .env
# edit .env with real secrets
docker compose -f docker-compose.yml up -d
```

**Option B: Image-only** (no repo, just the compose file):
```bash
mkdir remembrall && cd remembrall
curl -O https://raw.githubusercontent.com/cryizzle/remembrall/main/docker-compose.yml
cp /path/to/.env.example .env
# edit .env with real secrets
docker compose -f docker-compose.yml up -d
```

In both cases, the `api` service pulls from `ghcr.io/cryizzle/remembrall:latest` (or set `IMAGE_TAG` in `.env` to pin a version). Prisma migrations apply automatically on container start.

Generate a strong `POSTGRES_PASSWORD` for the server:

```bash
openssl rand -base64 48 | tr -d '/+=\n' | head -c 32
```

To build a new image, trigger the manual workflow in GitHub Actions:

- Go to the **Actions** tab → **Build & Push Docker Image** → **Run workflow**
- Enter a tag (e.g. `v0.1.1` or `latest`) and click **Run workflow**

The stack includes a `cloudflared` service that opens an outbound tunnel to Cloudflare — no router port forwarding, no inbound exposure of your home IP. Set up the tunnel once in the Cloudflare dashboard:

- Go to **Zero Trust → Networks → Tunnels → Create a tunnel**, choose **Cloudflared** as the connector.
- Copy the connector token Cloudflare gives you into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`.
- Add a **Public Hostname** to the tunnel:
  - Subdomain: `remembrall` (or whatever)
  - Domain: your Cloudflare-managed domain
  - Service: `HTTP` and `api:8989` (the docker service name, **not** localhost)
- Cloudflare auto-creates the CNAME + TLS cert.

Register the Telegram webhook against your public URL with a production `TELEGRAM_WEBHOOK_SECRET`:

```bash
source .env && curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://remembrall.your-domain.com/telegram/webhook\",
    \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\"
  }"
```

