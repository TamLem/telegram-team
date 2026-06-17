import { Hono } from "hono";
import type { Bot } from "@telegram-team/bot-engine";
import type { TelegramUpdate } from "@telegram-team/bot-engine";

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

    const update = await c.req.json<TelegramUpdate>();

    bot.handleUpdate(update).catch((err) => {
      console.error("[webhook] update handler error:", err);
    });

    return c.json({ ok: true });
  });

  return app;
}
