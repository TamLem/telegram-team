# TaskPi — Local Development

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm build

# Copy env template and fill in values
cp .env.local.example .env.local
# Edit .env.local with your BOT_TOKEN etc.

# Start all services + Cloudflare tunnel
pnpm dev
```

The dev script starts:
- API on port 3001
- Mini App on port 3002
- Cloudflare Tunnel (public HTTPS URL for Mini App)
- Bot in polling mode (reads your `.env.local` for config)

To skip the tunnel:

```bash
pnpm dev:no-tunnel
```

---

## Project Structure

```
telegram-team/
├── apps/
│   ├── api/          # REST API (Hono + SQLite)
│   ├── bot/          # Telegram Bot (custom engine)
│   └── miniapp/      # Telegram Mini App (Hono JSX)
├── packages/
│   ├── bot-engine/   # Custom bot framework
│   ├── shared/       # Shared types, schemas, utilities
│   ├── db/           # Database layer (Drizzle ORM)
│   └── config/       # Environment config loader
├── scripts/
│   └── dev.ts        # Dev orchestrator
├── data/
│   └── app.db        # SQLite database (gitignored)
└── docs/
```

---

## Configuration

All env vars are documented in `.env.local.example`. Copy it to `.env.local` and fill in values.

The config package (`@telegram-team/config`) auto-loads `.env.local` from the workspace root on import. Individual app `.env.example` files serve as documentation.

### Minimal dev setup

```env
NODE_ENV=development
API_PORT=3001
MINIAPP_PORT=3002
API_BASE_URL=http://localhost:3001
BOT_TOKEN=123456:your-bot-token
BOT_USERNAME=your_bot_username
BOT_UPDATE_MODE=polling
INTERNAL_API_KEY=dev-key
MINIAPP_CONTEXT_SECRET=dev-secret
MINIAPP_BASE_URL=http://localhost:3002
```

### Web browser access (Telegram Login Widget)

The Mini App works both inside Telegram and in a normal browser.

| Context | Auth |
|---------|------|
| Telegram Mini App / WebView | `Telegram.WebApp.initData` → `POST /app/auth` |
| Desktop/mobile browser | [Login Widget](https://core.telegram.org/widgets/login) → `POST /app/auth/web` |

To enable browser sign-in:

1. Set `BOT_USERNAME` (same bot that owns `BOT_TOKEN`, no `@`).
2. In [@BotFather](https://t.me/BotFather), run `/setdomain` and set the domain to your public Mini App host (production domain or Cloudflare tunnel host from `pnpm dev` — not `localhost`).
3. Open `https://<your-domain>/` (landing) or `https://<your-domain>/app` and use **Log in with Telegram** / **Open app**.

`MINIAPP_BASE_URL` is the site origin; product UI is under `/app`. The origin `/` serves a branded landing (not an empty 404). Both auth flows issue the same `ttp_session` cookie. Signed `?ctx=` action links still require the Telegram user id on the link to match the signed-in user.

---

## Database

### SQLite file location

Default: `data/app.db` in the workspace root. Set `DATABASE_URL` to override.

### Migration workflow

Migrations run automatically on API startup (`CREATE TABLE IF NOT EXISTS`). For schema changes:

```bash
# Edit packages/db/src/schema.ts, then:
pnpm db:generate  # Generate SQL migration
pnpm db:push      # Push directly to local DB
```

### Reset local database

```bash
rm data/app.db
pnpm build && pnpm dev
```

### Seed data (optional)

No seed script exists. Use the bot or API directly to create test data, or add a seed script in `scripts/`.

---

## Running Individual Services

```bash
# API only
node apps/api/dist/index.js

# Mini App only
node apps/miniapp/dist/index.js

# Bot only (polling mode)
BOT_UPDATE_MODE=polling node apps/bot/dist/index.js
```

---

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- apps/api/src/routes/tasks.test.ts
```

Tests use `node:test` and `node:assert/strict`. Run with `tsx --test`.

---

## Architecture Rules

- **Bot** = launcher + notification surface (no form wizardry)
- **Mini App** = structured interaction UI (SSR with Hono JSX)
- **API** = source of truth (REST, SQLite)
- **Database** = durable state

The bot should never become a form wizard. Always direct complex interactions to the Mini App via signed context links.

---

## Troubleshooting

### Bot not responding
- Check `BOT_TOKEN` is correct
- In polling mode, only one instance should run
- In webhook mode, `BOT_WEBHOOK_URL` must be a valid HTTPS URL

### Mini App "Open this app from Telegram" error
- Mini Apps must be opened inside Telegram
- URL must be HTTPS (use Cloudflare Tunnel in dev)
- `BOT_TOKEN` must match the bot that the Mini App is linked to

### API errors
- Check database exists at the path in `DATABASE_URL`
- Verify `INTERNAL_API_KEY` is same in both API and Bot configs

### "Link Expired" in Mini App
- Context tokens expire after 15 minutes
- Open the action again from the bot
