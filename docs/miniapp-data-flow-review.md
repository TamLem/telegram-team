# Mini App Data Flow Review

Date: 2026-06-18 (updated: stateless context model)

## Architecture

```
┌─────────────┐   web_app button      ┌──────────────┐   fetch + X-User-Id     ┌─────────────┐
│  Telegram   │  /app/tasks/new       │   Mini App   │ ─────────────────────> │     API     │
│  Client     │  ?ctx=<signed_token>  │  (Hono SSR)  │                        │  (Hono+DB)  │
└─────────────┘                      └──────────────┘                        └─────────────┘
       ▲                                     │  ttp_session cookie (15m)            ▲
       │ Bot API                             │  + ctx token in every URL            │
       │                                     ▼                                     │ HTTP + X-User-Id
┌──────┴──────┐                      ┌──────────────┐                          │
│    Bot      │ ───────────────────> │     API      │ <────────────────────────┘
│ (bot-engine)│   HTTP + X-User-Id   │              │
└─────────────┘                      └──────────────┘
```

## Stateles Context Model

No `action_sessions` table. No bot conversation state. No wizard-style task creation.

### Signed Context Token (`packages/shared/src/miniAppContext.ts`)

`createSignedMiniAppContext(input)` creates an HMAC-signed base64url token containing:
- `action` (create_task, view_task, edit_task, assign_task, change_status, add_comment, view_board, view_my_tasks)
- `telegramUserId`
- `teamId`
- `returnChatId`
- `taskId` (optional)
- `expiresAt` (15-minute default)
- `nonce` (random 8-byte hex)

`verifySignedMiniAppContext(token)` validates signature + expiry using `MINIAPP_CONTEXT_SECRET` (falls back to `MINIAPP_SESSION_SECRET`, then `BOT_TOKEN`).

### Auth Flow

1. **Bot** generates a signed ctx token and sends a `web_app` inline button with URL `${MINIAPP_BASE_URL}/app/tasks/new?ctx=<token>` (`apps/bot/src/telegram/webApp.ts`).
2. **Mini App middleware** (`requireMiniAppContext`) verifies the ctx token. If no session cookie, renders a bootstrap HTML page that:
   - Reads `window.Telegram.WebApp.initData`
   - POSTs `{ initData, ctx }` to `/app/auth` via `fetch` (not a form POST — avoids cookie loss on 302 in WKWebView)
   - Redirects client-side to the returned URL
3. **`/app/auth`** validates initData HMAC, verifies ctx, compares Telegram user ID from initData with `ctx.telegramUserId`, issues a `ttp_session` cookie (15-minute, signed, httpOnly, SameSite=Lax), returns `{ redirect: "<path>?ctx=<token>" }`.
4. On the redirected request, the middleware reads the cookie, attaches `telegramUser` + `apiUser` + `ctx` to the Hono context, and renders the page.

### Validation Rules

Every Mini App request with `ctx` validates:
- Signature is valid (HMAC-SHA256, timingSafeEqual)
- Token is not expired (15-minute default)
- Telegram initData is valid (HMAC, auth_date freshness)
- Telegram user from initData matches `ctx.telegramUserId`
- User exists or is created in API
- User is active member of `ctx.teamId` (enforced by API)
- `ctx.taskId` belongs to `ctx.teamId` (enforced by API)

### What Was Removed

- Bot conversation state Maps (`conversationStates`, `userState` in `onboarding.ts`)
- Multi-step task creation wizard (`newtask.ts` no longer takes a title argument — it opens the Mini App form)
- `getUserState`/`setUserState` exports from `onboarding.ts`
- `MINIAPP_DEV_USER_ID` bypass (dev uses Telegram via tunnel, so initData is always available)
- `tgWebAppData` query param check (Telegram passes init data in the hash fragment, which never reaches the server)
- The `/app/launch` + `/app/session` form-POST bootstrap (replaced by the middleware-rendered bootstrap page + `/app/auth` fetch endpoint)

## Remaining Issues

### 1. API trusts `X-User-Id` header with no authentication

**Severity: CRITICAL**

The API has no Telegram validation, no JWT, no shared secret. Every route reads
the user from a bare `X-User-Id` header:

```ts
function getUserId(c: any): string {
  return c.get("apiUser")?.id ?? c.req.header("X-User-Id") ?? "";
}
```

Anyone who can reach the API can impersonate any user by sending
`X-User-Id: <uuid>`.

**Files:** `apps/api/src/routes/tasks.ts:30-32`, `teams.ts:20-22`, `users.ts:7-9`

**Fix direction:** Validate a signed token (JWT or HMAC) from the miniapp/bot,
or ensure the API is network-isolated to only accept traffic from the
miniapp/bot.

### 2. `PUT /api/users/telegram/:telegramUserId` is unauthenticated

**Severity: CRITICAL**

Anyone can create or update a user record with an arbitrary Telegram ID and
arbitrary name/username. This is the entry point used by both the miniapp and
bot to upsert users.

**Files:** `apps/api/src/routes/users.ts:40-60`

## Fixed Issues

The following issues from the original review have been resolved:

- ~~Session cookie signing key falls back to `BOT_TOKEN`~~ — now uses `MINIAPP_CONTEXT_SECRET` with explicit fallback chain.
- ~~Dev-mode auth bypass fires before cookie check~~ — dev bypass removed entirely; dev uses Telegram via tunnel.
- ~~`MINIAPP_DEV_USER_ID` empty string causes `NaN`~~ — `MINIAPP_DEV_USER_ID` removed.
- ~~`tgWebAppData` query param check (hash fragment never reaches server)~~ — replaced by `ctx` token + `/app/auth` fetch bootstrap.
- ~~Help command `<a href>` won't open as Mini App~~ — help command no longer links to the miniapp.
- ~~Bot in-memory conversation state lost on restart~~ — conversation state Maps removed; bot is now stateless.
- ~~Multi-step task creation wizard~~ — removed; `/newtask` opens the Mini App form with signed ctx.

## Low Issues

### 3. No `setChatMenuButton` call

The Mini App is not discoverable via the Telegram menu button. Telegram's docs
recommend configuring it.

### 4. No viewport-changed handling

The miniapp uses `100vh` CSS which is unreliable in Telegram's iOS WebView.
Should listen to `WebApp.onEvent('viewportChanged')` and use
`viewportStableHeight`.

**Files:** `apps/miniapp/src/views/layout.tsx:14,73`

### 5. `localeCompare` sort in data-checking string

The official spec says "sort alphabetically"; `localeCompare` is
locale-sensitive. For ASCII parameter names this is fine, but byte-wise
comparison would be more spec-faithful.

**Files:** `apps/miniapp/src/auth/validateTelegramInitData.ts:23`

### 6. No `MainButton`/`BackButton`/`HapticFeedback` integration

The miniapp uses plain HTML buttons instead of native Telegram UI components.

### 7. Stale `packages/db/scripts/migrate.ts`

Has an incompatible schema. Running it would create wrong tables.

### 8. Webhook secret token compared with `!==`

Should use `crypto.timingSafeEqual` to avoid timing attacks.

**Files:** `apps/bot/src/updateSources/webhook.ts:19`
