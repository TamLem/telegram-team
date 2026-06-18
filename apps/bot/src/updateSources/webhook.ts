import { Hono } from "hono";
import type { Bot } from "@telegram-team/bot-engine";
import type { TelegramUpdate } from "@telegram-team/bot-engine";
import { logError } from "../logger.js";

export interface WebhookConfig {
  secretToken?: string;
  path?: string;
}

export function createWebhookApp(bot: Bot, config: WebhookConfig = {}): Hono {
  const { secretToken, path = "/telegram/webhook" } = config;

  const app = new Hono();

  app.post(path, async (c) => {
    if (secretToken) {
      const token = c.req.header("X-Telegram-Bot-Api-Secret-Token");
      if (token !== secretToken) {
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

    const result = await bot.handleUpdate(update);
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
