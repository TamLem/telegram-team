# TaskPi — Deployment Guide

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
- A domain (e.g., `taskpi.example.com`) pointed to your VPS

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
2. **Source**: Git repository (point to your TaskPi fork)
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
BOT_WEBHOOK_URL=https://taskpi.example.com
MINIAPP_BASE_URL=https://taskpi.example.com

# Telegram
BOT_TOKEN=12345:abcde...
BOT_USERNAME=YourTaskPiBot

# Internal secrets
INTERNAL_API_KEY=<generated-hex>
MINIAPP_CONTEXT_SECRET=<generated-hex>
BOT_WEBHOOK_SECRET=<generated-hex>

# SQLite is bind-mounted from host /var/lib/taskpi/data → container /app/data
# (see docker-compose.yml; no SQLITE_HOST_PATH env needed)
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
curl https://taskpi.example.com/health
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

1. **API** starts first, opens the host-mounted SQLite file under `/app/data`, auto-creates/migrates tables via `CREATE TABLE IF NOT EXISTS`, listens on port 3001 (internal only)
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
| `DATABASE_URL` | Set in compose to `/app/data/app.db` (host dir is hardcoded) | — |

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

SQLite lives on the **host** and is bind-mounted into the API container (hardcoded in `docker-compose.yml`):

| Side | Path |
|------|------|
| Host | `/var/lib/taskpi/data` |
| Container | `/app/data/app.db` |

Ensure the host directory exists and contains `app.db` before deploying:

```bash
sudo mkdir -p /var/lib/taskpi/data
ls -la /var/lib/taskpi/data/app.db
```

### Backup (host)

```bash
# Prefer a consistent snapshot (install sqlite3 on the host if needed)
sqlite3 /var/lib/taskpi/data/app.db ".backup /var/lib/taskpi/data/app.db.backup.$(date +%Y%m%d%H%M%S)"

# Or copy while API is stopped
docker compose stop api
cp /var/lib/taskpi/data/app.db /var/lib/taskpi/data/app.db.backup.$(date +%Y%m%d%H%M%S)
docker compose start api
```

### Restore (host)

```bash
docker compose stop api
cp /path/to/app.db.backup /var/lib/taskpi/data/app.db
# remove stale WAL if restoring a full backup file from .backup
rm -f /var/lib/taskpi/data/app.db-wal /var/lib/taskpi/data/app.db-shm
docker compose start api
```

### Local introspection via Tailscale

With the DB on the host, you can inspect or edit without entering a named volume:

```bash
ssh user@vps-tailscale
sqlite3 /var/lib/taskpi/data/app.db
# or scp the file / a .backup snapshot to your laptop
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
