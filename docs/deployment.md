# TaskPilot — Deployment Guide

## Overview

TaskPilot is a Telegram bot + Mini App for team task management. It consists of three services:

| Service | Purpose | Port |
|---------|---------|------|
| `apps/api` | REST API — source of truth | 3001 (configurable via `API_PORT`) |
| `apps/miniapp` | Telegram Mini App — SSR HTML | 3002 (configurable via `MINIAPP_PORT`) |
| `apps/bot` | Telegram Bot — webhook/polling | 3000 (configurable via `BOT_PORT`) |

All services load configuration from `.env.local` at the workspace root.

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- (Production) A domain with HTTPS for the bot webhook and Mini App

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values.

### Critical variables

```env
# ALL services
INTERNAL_API_KEY=<generate-a-random-string>
MINIAPP_CONTEXT_SECRET=<generate-a-random-string>

# API
API_PORT=3001
DATABASE_URL=../../data/app.db

# Mini App
MINIAPP_PORT=3002
API_BASE_URL=http://localhost:3001
BOT_TOKEN=<your-bot-token>
MINIAPP_CONTEXT_SECRET=<same-as-above>

# Bot
BOT_TOKEN=<your-bot-token>
BOT_USERNAME=<your-bot-username>
BOT_UPDATE_MODE=webhook
BOT_WEBHOOK_SECRET=<generate-a-random-string>
BOT_PORT=3000
API_BASE_URL=http://localhost:3001
MINIAPP_BASE_URL=https://your-domain.com
INTERNAL_API_KEY=<same-as-above>
MINIAPP_CONTEXT_SECRET=<same-as-above>
```

---

## Starting Services

### 1. Build

```bash
pnpm install
pnpm build
```

### 2. Run migrations

```bash
pnpm db:migrate
```

Or simply start the API — migrations run automatically on startup via `CREATE TABLE IF NOT EXISTS`.

### 3. Start API

```bash
node apps/api/dist/index.js
```

Verify: `GET http://localhost:3001/health` returns `{"status": "ok"}`.

### 4. Start Mini App

```bash
node apps/miniapp/dist/index.js
```

Verify: `GET http://localhost:3002/health` returns `{"status": "ok"}`.

### 5. Start Bot (webhook mode)

```bash
node apps/bot/dist/index.js
```

The bot automatically registers commands and sets the webhook if `BOT_WEBHOOK_URL` is provided.

---

## Setting the Telegram Webhook

When using `BOT_UPDATE_MODE=webhook`, the bot calls `setWebhook` on startup using `BOT_WEBHOOK_URL`.

To manually set or delete the webhook:

```bash
# Set webhook
pnpm telegram:set-webhook

# Delete webhook (to switch back to polling)
pnpm telegram:delete-webhook
```

Or use the scripts directly:

```bash
tsx apps/bot/scripts/setWebhook.ts
tsx apps/bot/scripts/deleteWebhook.ts
```

---

## Production Bot Mode

Production should use `BOT_UPDATE_MODE=webhook`:

```env
BOT_UPDATE_MODE=webhook
BOT_WEBHOOK_URL=https://your-domain.com
BOT_WEBHOOK_SECRET=<random-secret>
```

Set the webhook secret in `BOT_WEBHOOK_SECRET` to verify incoming webhook requests from Telegram.

**Do not use polling mode in production.** It is only suitable for local development.

---

## Cloudflare Tunnel (for local Mini App testing)

Since Telegram Mini Apps require HTTPS, use Cloudflare Tunnel for local development:

```bash
pnpm dev
```

The root dev script (`scripts/dev.ts`) starts all three services plus a Cloudflare tunnel automatically.

Run without the tunnel:

```bash
pnpm dev:no-tunnel
```

---

## Database

### SQLite

The MVP uses SQLite via `better-sqlite3`. The database file path is set via `DATABASE_URL`.

Migrations run automatically in `packages/db/src/client.ts` using `CREATE TABLE IF NOT EXISTS` DDL. The drizzle-kit config is available for generating typed migrations:

```bash
pnpm db:generate  # Generate migration SQL from schema
pnpm db:push      # Push schema changes directly
```

### Production backup

SQLite is a single-file database. Back it up by copying the file:

```bash
cp data/app.db data/app.db.backup.$(date +%Y%m%d%H%M%S)
```

Do this while the API is stopped or use `sqlite3` with `.backup` command for live backups.

---

## Health Check URLs

| Service | Health | Readiness |
|---------|--------|-----------|
| API | `GET /health` | `GET /ready` (checks DB) |
| Mini App | `GET /health` | `GET /ready` |
| Bot (webhook) | `GET /health` | `GET /ready` |

---

## Important Notes

- **No secrets committed to git.** `.env.local` is gitignored.
- **All app URLs come from environment variables.** No hardcoded localhost in production.
- **Missing critical env vars cause immediate exit** with a clear error message.
- **The bot token must never be logged.** Structured logging excludes it.
