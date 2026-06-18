# Telegram Bot Framework Review

Date: 2026-06-18

This document records the review of the Telegram bot interaction implementation, Mini App integration, command registration, update handling, and related framework code.

## Scope

- Custom bot engine in `packages/bot-engine`
- Bot command and callback handlers in `apps/bot`
- Webhook and polling update sources
- Telegram Mini App authentication and route integration in `apps/miniapp`
- API access paths that are directly exercised by bot and Mini App flows

## Findings

### High Severity

#### Task status callback buttons are broken

`bot.callback(/^task:/, taskCallback)` matches only the `task:` prefix. `taskCallback` then parses `match[0]`, so for callback data such as `task:status:doing:<taskId>`, the handler sees only `task:` and `taskId` is undefined. The handler returns without updating the task or answering the callback query.

Relevant files:

- `apps/bot/src/index.ts`
- `apps/bot/src/callbacks/task.ts`

Recommended direction:

- Parse `ctx.callbackData` directly, or register callbacks with full regex capture groups.
- Always answer callback queries, including malformed or unsupported callback data.
- Add routing tests for every callback data shape emitted by bot keyboards.

#### Production Mini App launch requests do not authenticate

`requireMiniAppUser` expects Telegram init data in `tgWebAppData` or `X-Telegram-Init-Data`, but the server-rendered Mini App pages linked by bot `web_app` buttons do not forward `window.Telegram.WebApp.initData` on the first request. In production, routes such as `/app/tasks/:id` and `/app/board/:teamId` can fail with missing init data.

Relevant files:

- `apps/miniapp/src/auth/requireMiniAppUser.ts`
- `apps/miniapp/src/views/layout.tsx`

Recommended direction:

- Establish one supported Mini App auth transport.
- Prefer a Telegram launch bootstrap route that receives and validates init data, then issues an application session.
- Avoid relying on browser-side JavaScript to make the initial server-rendered GET authenticated unless the URL explicitly carries signed init data.

#### Task and related detail reads can bypass user context

Mini App API client methods for task details, comments, and events do not pass `X-User-Id`. The API task detail endpoint only checks membership when a user id is present. Comments and events are returned without a membership check. Direct API callers can read task metadata, comments, or events if they know an id.

Relevant files:

- `apps/miniapp/src/services/apiClient.ts`
- `apps/api/src/routes/tasks.ts`

Recommended direction:

- Require authenticated user context for all task, comment, event, team, and board reads.
- Make API authorization explicit and deny by default.
- Pass the authenticated Mini App user id through all downstream API calls.

#### Join approval flow cannot reach admins

After a user enters an invite code, the bot calls `/join-requests` using the requester user id, but the endpoint requires admin access. Even if the request lookup succeeded, the approve/reject keyboard is sent with `ctx.reply`, which sends the message back into the requester chat rather than to an admin chat.

Relevant file:

- `apps/bot/src/callbacks/onboarding.ts`

Recommended direction:

- Store or derive admin Telegram chat ids for each team.
- Notify admins directly when a join request is created.
- Keep approval actions tied to authorized admin users.
- Add an end-to-end test for join request creation, admin notification, approval, and member activation.

### Medium Severity

#### Telegram HTML output is not escaped

The bot sends messages with HTML parse mode and interpolates user names, team names, task titles, and similar user-controlled content without escaping. This can break message delivery or alter formatting.

Relevant files:

- `apps/bot/src/commands/start.ts`
- `apps/bot/src/commands/newtask.ts`
- `apps/bot/src/callbacks/task.ts`

Recommended direction:

- Add a shared Telegram HTML escaping helper.
- Use it for all user-controlled text rendered into HTML parse-mode messages.
- Consider typed message builders for repeated task/team/user cards.

#### Mini App init data validation lacks replay protection

The Mini App validates the Telegram HMAC, but it does not validate `auth_date` freshness. Captured valid init data can be reused indefinitely. Malformed `user` JSON can also throw and become a server error instead of a clean authorization failure.

Relevant file:

- `apps/miniapp/src/auth/validateTelegramInitData.ts`

Recommended direction:

- Validate `auth_date` against a short maximum age.
- Handle malformed JSON as invalid init data.
- Use timing-safe comparison for hashes.
- Add unit tests using known-good and known-bad Telegram init data examples.

#### Webhook and polling acknowledge updates before handlers complete

The webhook responds with success immediately after starting `bot.handleUpdate`. Polling advances `offset` before awaiting update handling. If the process crashes or a handler fails after acknowledgement, Telegram will not retry the update.

Relevant files:

- `apps/bot/src/updateSources/webhook.ts`
- `apps/bot/src/updateSources/polling.ts`

Recommended direction:

- Await update handling before acknowledging the webhook unless there is an intentional durable queue.
- In polling mode, advance offset after successful handling or after a deliberate dead-letter decision.
- If asynchronous acknowledgement is required, introduce durable work storage and retry semantics.

### Low Severity

#### Telegram command menu is not registered

The bot routes `/start`, `/help`, `/newtask`, `/mytasks`, and `/board` locally, but the Telegram command menu is never registered through `setMyCommands`.

Relevant files:

- `apps/bot/src/index.ts`
- `packages/bot-engine/src/api.ts`
- `apps/bot/scripts/setWebhook.ts`

Recommended direction:

- Add `TelegramApi.setMyCommands`.
- Register public commands during deployment or webhook setup.
- Keep local command router definitions and Telegram command metadata in one shared declaration.

#### Group commands addressed to other bots are accepted

The command router strips `@username` and dispatches the command without checking whether the mention targets this bot. In groups with multiple bots, this bot can respond to commands intended for another bot.

Relevant file:

- `packages/bot-engine/src/router.ts`

Recommended direction:

- Track this bot's username from `getMe`.
- Ignore commands addressed to a different bot username.
- Cover private chat, group chat, and command mention cases in router tests.

## Architectural And Code Quality Improvement Goal

### Goal

Move the Telegram integration from scattered, flow-specific handlers toward a cohesive, testable interaction architecture with explicit contracts for routing, authentication, authorization, message rendering, and update acknowledgement.

### Target State

- Bot commands, callback actions, and Telegram command metadata are defined from a shared registry.
- Callback data is structured, validated, and parsed by a single module rather than ad hoc string splitting.
- Mini App authentication has one clear server-side flow, with short-lived validated Telegram launch data exchanged for an application session.
- API routes deny by default and require authenticated user context for all protected resource reads and writes.
- Telegram message rendering uses shared builders and escaping helpers.
- Update processing has explicit acknowledgement semantics for webhook and polling modes.
- Interaction behavior is covered by focused tests at the router, handler, auth, and API integration layers.

### Improvement Principles

- Prefer typed contracts over string conventions for command names, callback payloads, statuses, and route inputs.
- Centralize repeated user sync, team selection, and API client behavior.
- Keep bot handlers thin: parse the interaction, call application services, render a response.
- Keep authorization in API/application services, not in UI assumptions.
- Treat Telegram-specific behavior as infrastructure around the domain model, not as the domain model itself.

### Suggested Work Plan

1. Fix callback parsing and add tests for all emitted callback payloads.
2. Add Telegram HTML escaping and message builder helpers.
3. Make Mini App auth production-safe with validated launch data and a session strategy.
4. Require user context on protected API reads and update Mini App API calls accordingly.
5. Redesign join-request notifications so admins receive actionable approval messages.
6. Add command metadata registration through `setMyCommands`.
7. Rework webhook and polling acknowledgement semantics or introduce a durable queue.
8. Consolidate bot command/callback declarations into a registry shared by runtime registration, Telegram command setup, and tests.

## Testing Gaps

No test files were found during the review.

Highest-value coverage:

- Command router behavior, including bot mentions in groups
- Callback router behavior for all callback data emitted by keyboards
- Mini App init data validation, including expiry and malformed payloads
- Protected API read access for tasks, comments, events, teams, and boards
- Join request lifecycle from requester submission to admin approval
- Webhook and polling update acknowledgement behavior
