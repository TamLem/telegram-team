# Planned Tasks

Deferred work that is intentional, not forgotten. Items here are out of scope until explicitly scheduled.

---

## Multi-team follow-ups (leave / ownership)

| Field | Value |
|-------|--------|
| **Status** | Planned — after multi-team v1 |
| **Priority** | Medium |
| **Depends on** | Multi-team preferred team + bot/Mini App selection (shipped or in progress) |

### Context

Multi-team v1 enables create/join many teams, preferred team, cross-team My Tasks, and selection UX. Membership lifecycle is incomplete:

- No **self-leave** API
- No **transfer ownership** / last-owner delete rules
- Preferred team clear on admin remove already exists; leave should do the same

### When to schedule

When users regularly join more than one team and need to leave without admin removal.

---

## Separate notification (and deadline) poller into its own process

| Field | Value |
|-------|--------|
| **Status** | Planned — not urgent |
| **Priority** | Medium (reliability isolation; not required while in-process fixes hold) |
| **Created** | 2026-07-14 |
| **Related** | Production bot stall investigation; notification retry storm mitigation |

### Context

Today the bot process does two jobs:

1. **Interactive path** — Telegram webhook (or polling) update handling
2. **Background delivery** — `NotificationPoller` (every 5s) and `DeadlinePoller` (every 5m) inside `apps/bot/src/index.ts`

A backlog of undeliverable notifications (blocked users, missing chats) plus stacked poll passes can compete with webhook handling for the Node event loop and the shared Bot API token, which shows up as the bot “stalling.”

In-process mitigations already land or are preferred first:

- In-flight guard so poll intervals do not stack
- Request timeouts on bot → API and Telegram API calls
- Dead-letter after permanent Telegram delivery failures (or max retries)
- Webhook handler timeout (`BOT_HANDLER_TIMEOUT_MS`)

Those keep a single process viable for current scale. **Process isolation is the next hardening step when urgency rises** (recurring stalls, larger notification volume, or desire to restart delivery without touching the webhook service).

### Goal

Run notification delivery (and optionally deadline checks) as a **separate Compose service / process** so webhook latency and crash/restart behavior are independent of background delivery.

### Non-goals (for this task)

- Multi-replica notifier without claim/lease semantics
- Replacing SQLite or introducing a message queue product
- Changing notification payload formats or Mini App link generation

### Target shape

```
api        — source of truth (unchanged)
bot        — webhook/polling only; no NotificationPoller / DeadlinePoller
notifier   — same image, different entry; polls undelivered + deadline-check
miniapp    — unchanged
```

Suggested implementation options (pick one when scheduled):

- Dedicated entry: `apps/bot/src/notifier.ts` → `node apps/bot/dist/notifier.js`
- Or role flag: `BOT_ROLE=webhook|notifier` on the existing bot package

### Implementation outline

1. Extract poller startup from `apps/bot/src/index.ts` into a notifier entrypoint that:
   - Validates `BOT_TOKEN`, `API_BASE_URL`, `INTERNAL_API_KEY`, Mini App env needed for links
   - Does **not** set/delete webhooks or listen for updates
   - Starts `NotificationPoller` and `DeadlinePoller`
   - Exposes a small `/health` (or process-level healthcheck) for Compose/Coolify
2. Add a `notifier` service to `docker-compose.yml` (same image as bot, different `command`).
3. Ensure bot service no longer starts pollers in production webhook mode (and preferably never, so local/dev can run notifier separately or via `scripts/dev.ts` when desired).
4. Update `docs/deployment.md` and env reference tables.
5. Tests: notifier entry boots with mocks; bot entry does not schedule pollers; health endpoint if added.

### Constraints and risks

| Topic | Note |
|-------|------|
| Telegram rate limits | Still **per bot token**, not per process. Isolation improves event-loop and deploy blast radius, not API quota. |
| Duplicate delivery | Only one notifier instance until notifications support claim/lease (`claimed_at` / `delivery_attempts` or equivalent). |
| Shared secrets | Notifier needs the same `BOT_TOKEN` as the bot to call `sendMessage`. |
| Local dev | Decide whether `pnpm dev` starts notifier inline, as a second process, or only on demand. |

### When to schedule

Pull this forward if any of the following become true:

- Webhook response times or user-facing stalls correlate with notification backlog
- Operators need to restart delivery without re-registering the webhook
- Notification volume or dead-letter rate grows enough to dominate bot logs/CPU
- Multiple environments need independent scaling of bot vs delivery

### Acceptance criteria

- [ ] Production Compose runs bot without in-process notification/deadline pollers
- [ ] A dedicated notifier process delivers undelivered notifications and runs deadline checks
- [ ] Bot restart does not stop an already-running notifier (and vice versa), subject to Compose wiring
- [ ] Docs describe the two processes and required env vars
- [ ] Existing delivery reliability behavior (timeouts, permanent-failure dead-letter, no stacked polls) is preserved

### References

- `apps/bot/src/notifications/poller.ts`
- `apps/bot/src/notifications/deadlinePoller.ts`
- `apps/bot/src/index.ts`
- `docker-compose.yml` (`bot` service)
- `docs/deployment.md`
