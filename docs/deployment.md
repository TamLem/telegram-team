# TaskPilot — Deployment Guide

## Architecture

Three services, deployed via Docker Compose on Coolify. Routing and TLS are handled by Coolify's built-in Traefik.

```
Internet
  │  HTTPS (Coolify Traefik)
  ├── /telegram/webhook  →  bot:3000
  ├── /app/*              →  miniapp:3002
  └── /health             →  miniapp:3002

api:3001  ←── internal calls from bot and miniapp (Docker network, not publicly exposed)
```

| Service | Role | Public? | Port |
|---------|------|---------|------|
| `api` | Source of truth (REST + SQLite) | No — internal only | 3001 |
| `miniapp` | Mini App SSR (HTML to Telegram WebView) | Yes (via Traefik) | 3002 |
| `bot` | Telegram bot (webhook receiver) | Yes (via Traefik) | 3000 |

---

## Prerequisites

- A VPS managed by [Coolify](https://coolify.io)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A domain (e.g., `taskpilot.example.com`) pointed to your VPS

---

## Deploy via Coolify (Docker Compose)

### 1. Generate secrets

```bash
# Random keys for internal security
openssl rand -hex 32  # → INTERNAL_API_KEY
openssl rand -hex 32  # → MINIAPP_CONTEXT_SECRET
openssl rand -hex 32  # → BOT_WEBHOOK_SECRET
```

### 2. Create the Coolify service

1. In Coolify, go to your project → **+ New** → **Docker Compose**
2. **Source**: Git repository (point to your TaskPilot fork)
3. **Branch**: `main`
4. **Compose File**: `docker-compose.yml` (default, already in repo root)

### 3. Configure domain routing in Coolify

Coolify's Traefik handles TLS and routing. Configure path-based routing in the Coolify UI so that:

- `https://your-domain.com/telegram/webhook` → `bot` service (port 3000)
- `https://your-domain.com/*` → `miniapp` service (port 3002)

### 4. Set environment variables

In Coolify's environment variables UI for this service, add:

```env
# Domain (used by bot to register webhook and generate Mini App URLs)
BOT_WEBHOOK_URL=https://taskpilot.example.com
MINIAPP_BASE_URL=https://taskpilot.example.com

# Telegram
BOT_TOKEN=12345:abcde...
BOT_USERNAME=YourTaskPilotBot

# Internal secrets
INTERNAL_API_KEY=<generated-hex>
MINIAPP_CONTEXT_SECRET=<generated-hex>
BOT_WEBHOOK_SECRET=<generated-hex>

# Database (defaults to /app/data/app.db — persisted via Docker volume)
# DATABASE_URL=/app/data/app.db
```

### 5. Deploy

Click **Deploy**. Coolify will:

1. Clone the repo
2. Build the Docker image (installs deps, compiles TypeScript, prunes devDeps)
3. Start all 3 services (api, miniapp, bot)
4. Provision TLS via Traefik
5. Route traffic to miniapp and bot based on path

### 6. Verify

```bash
# Health checks (through the public domain)
curl https://taskpilot.example.com/health
# → {"status": "ok"}

# Bot webhook should be registered automatically on startup.
# Check Telegram: send /start to your bot.
```

### 7. Pushing updates

```bash
git push origin main
```

Then click **Redeploy** in Coolify. The Docker build cache speeds up subsequent builds.

---

## What Happens on Startup

1. **API** starts first, auto-creates SQLite tables via `CREATE TABLE IF NOT EXISTS`, listens on port 3001 (internal only)
2. **Mini App** boots, validates env vars, starts serving SSR pages on port 3002
3. **Bot** boots, calls `getMe` to verify the token, registers bot commands via `setMyCommands`, calls `setWebhook` to point Telegram at `https://domain/telegram/webhook` (with `BOT_WEBHOOK_SECRET` for header verification), listens on port 3000
4. **Notification poller** starts inside the bot process, polling the API every 5s for undelivered notifications

The webhook URL is constructed as `${BOT_WEBHOOK_URL}/telegram/webhook`. The bot uses `BOT_WEBHOOK_SECRET` to verify that incoming webhook requests really come from Telegram (validated via `X-Telegram-Bot-Api-Secret-Token` header).

---

## Environment Variables Reference

### All services

| Variable | Purpose | Required |
|----------|---------|----------|
| `INTERNAL_API_KEY` | Secures `/api/internal/*` endpoints | Yes |
| `MINIAPP_CONTEXT_SECRET` | HMAC key for Mini App signed context tokens | Yes |

### API (`apps/api`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `API_PORT` | HTTP listen port | `3001` |
| `DATABASE_URL` | SQLite file path | `<workspace>/data/app.db` |

### Mini App (`apps/miniapp`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `MINIAPP_PORT` | HTTP listen port | `3002` |
| `API_BASE_URL` | Internal API URL | `http://api:3001` |
| `BOT_TOKEN` | Telegram bot token (for initData validation) | — |
| `MINIAPP_CONTEXT_SECRET` | Context token HMAC key | — |

### Bot (`apps/bot`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `BOT_TOKEN` | Telegram bot token | — |
| `BOT_USERNAME` | Bot username (for mention parsing) | — |
| `BOT_UPDATE_MODE` | `webhook` or `polling` | `polling` |
| `BOT_PORT` | HTTP listen port | `3000` |
| `BOT_WEBHOOK_URL` | Public URL for webhook registration | — |
| `BOT_WEBHOOK_SECRET` | Verifies webhook origin from Telegram | — |
| `API_BASE_URL` | Internal API URL | `http://api:3001` |
| `MINIAPP_BASE_URL` | Public Mini App URL (for generated links) | — |
| `INTERNAL_API_KEY` | Auth for notification poller API calls | — |
| `MINIAPP_CONTEXT_SECRET` | Context token HMAC key | — |

---

## Database

SQLite file stored at `/app/data/app.db` inside the container, persisted via the `db-data` Docker volume.

### Backup

```bash
# While the container is running
docker compose exec api cp /app/data/app.db /app/data/app.db.backup.$(date +%Y%m%d%H%M%S)
```

Then copy the backup from the volume to the host.

### Restore

```bash
# Stop the API first
docker compose stop api
# Replace the file on the volume
docker compose run --rm -v ./app.db:/restore.db api cp /restore.db /app/data/app.db
# Start the API
docker compose start api
```

---

## Troubleshooting

### Bot not responding

Check that the webhook is registered:
```bash
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```
You should see `url` set to your domain and no `last_error_message`.

### Mini App shows "Open from Telegram"

The Mini App validates Telegram initData. It only works inside a Telegram WebView. For local testing, use the Cloudflare tunnel dev setup instead.

### Database errors

```bash
# View API logs
docker compose logs api

# Check the DB file exists
docker compose exec api ls -la /app/data/
```

### Force webhook re-registration

The bot registers the webhook on startup. To force a re-register, restart the bot service:
```bash
docker compose restart bot
```
