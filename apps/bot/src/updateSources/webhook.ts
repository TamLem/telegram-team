import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import type { Bot } from "@telegram-team/bot-engine";
import type { TelegramUpdate } from "@telegram-team/bot-engine";
import { logError } from "../logger.js";

export interface WebhookConfig {
  secretToken?: string;
  path?: string;
  /** Max time to spend handling one update before responding 500. Default 25s. */
  handlerTimeoutMs?: number;
}

const DEFAULT_HANDLER_TIMEOUT_MS = 25_000;

export function createWebhookApp(bot: Bot, config: WebhookConfig = {}): Hono {
  const {
    secretToken,
    path = "/telegram/webhook",
    handlerTimeoutMs = DEFAULT_HANDLER_TIMEOUT_MS,
  } = config;

  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/ready", (c) => {
    return c.json({ status: "ready", timestamp: new Date().toISOString() });
  });

  app.post(path, async (c) => {
    if (secretToken) {
      const token = c.req.header("X-Telegram-Bot-Api-Secret-Token");
      if (!token || token.length !== secretToken.length) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const tokenBuf = Buffer.from(token);
      const secretBuf = Buffer.from(secretToken);
      if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    let update: TelegramUpdate;
    try {
      update = await c.req.json<TelegramUpdate>();
    } catch (err) {
      logError("[webhook] failed to parse update payload", err);
      return c.json({ error: "Invalid update payload" }, 400);
    }

    let result: Awaited<ReturnType<Bot["handleUpdate"]>>;
    try {
      result = await withTimeout(
        bot.handleUpdate(update),
        handlerTimeoutMs,
        `Webhook handler timed out after ${handlerTimeoutMs}ms`
      );
    } catch (error) {
      logError("[webhook] update handler timed out or threw", error, {
        updateId: update.update_id,
      });
      // 200 after timeout would drop the update; 500 lets Telegram retry once.
      // Prefer not hanging the connection — Telegram aborts around 60s.
      return c.json({ error: "Update handling timed out" }, 500);
    }

    if (!result.ok) {
      logError("[webhook] update handler failed", result.error, {
        updateId: update.update_id,
      });
      return c.json({ error: "Update handling failed" }, 500);
    }

    return c.json({ ok: true });
  });

  return app;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}
