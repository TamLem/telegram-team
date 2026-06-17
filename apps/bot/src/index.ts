import { serve } from "@hono/node-server";
import {
  createBot,
  logMiddleware,
  requireUser,
  extractCommandArgs,
} from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { startCommand } from "./commands/start.js";
import { helpCommand } from "./commands/help.js";
import { newTaskCommand } from "./commands/newtask.js";
import { myTasksCommand } from "./commands/mytasks.js";
import { boardCommand } from "./commands/board.js";
import { taskCallback } from "./callbacks/task.js";
import { PollingSource } from "./updateSources/polling.js";
import { createWebhookApp } from "./updateSources/webhook.js";

const botToken = getEnv("BOT_TOKEN");
const updateMode = process.env.BOT_UPDATE_MODE ?? "webhook";

const bot = createBot(botToken);

bot.use(logMiddleware());
bot.use(requireUser());
bot.use(extractCommandArgs());

bot.command("/start", startCommand);
bot.command("/help", helpCommand);
bot.command("/newtask", newTaskCommand);
bot.command("/mytasks", myTasksCommand);
bot.command("/board", boardCommand);

bot.callback(/^task:/, taskCallback);

bot.onError(async (error, ctx) => {
  console.error("[bot] error:", error.message);
  try {
    await ctx.reply("Something went wrong. Please try again.");
  } catch {
    // ignore reply errors in error handler
  }
});

async function main() {
  console.log(`[bot] update mode: ${updateMode}`);

  if (updateMode === "polling") {
    const polling = new PollingSource(bot.api, bot);

    const dropPending =
      process.env.DROP_PENDING_UPDATES === "true";

    // Handle graceful shutdown
    process.on("SIGINT", () => polling.stop());
    process.on("SIGTERM", () => polling.stop());

    await polling.start({ dropPendingUpdates: dropPending });
    return;
  }

  if (updateMode === "webhook") {
    const webhookSecret = process.env.BOT_WEBHOOK_SECRET;
    const port = parseInt(
      process.env.BOT_PORT ?? getEnv("PORT", "3000")
    );
    const publicUrl = process.env.BOT_WEBHOOK_URL;

    const app = createWebhookApp(bot, {
      secretToken: webhookSecret,
      path: "/telegram/webhook",
    });

    if (publicUrl) {
      const webhookUrl = `${publicUrl}/telegram/webhook`;
      await bot.api
        .setWebhook(webhookUrl, webhookSecret)
        .then(() => {
          console.log(`[webhook] set to ${webhookUrl}`);
        })
        .catch((err) => {
          console.error("[webhook] failed to set:", err.message);
        });
    }

    console.log(`[bot] webhook server listening on port ${port}`);

    serve({ fetch: app.fetch, port });
    return;
  }

  console.error(
    `[bot] invalid BOT_UPDATE_MODE: "${updateMode}". Use "polling" or "webhook".`
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[bot] fatal:", err);
  process.exit(1);
});
