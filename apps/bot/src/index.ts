import { serve } from "@hono/node-server";
import {
  createBot,
  logMiddleware,
  requireUser,
  extractCommandArgs,
} from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { PollingSource } from "./updateSources/polling.js";
import { createWebhookApp } from "./updateSources/webhook.js";
import { BOT_COMMANDS, registerBotInteractions } from "./interactions.js";
import { logError } from "./logger.js";

const botToken = getEnv("BOT_TOKEN");
const updateMode = process.env.BOT_UPDATE_MODE ?? "webhook";

const bot = createBot(botToken);

bot.use(logMiddleware());
bot.use(requireUser());
bot.use(extractCommandArgs());

registerBotInteractions(bot);

bot.onError(async (error, ctx) => {
  logError("[bot] update error", error, {
    updateId: ctx.update.update_id,
    userId: ctx.userId,
    chatId: ctx.chatId,
    callbackData: ctx.callbackData,
    text: ctx.text,
  });
  try {
    await ctx.reply("Something went wrong. Please try again.");
  } catch (replyError) {
    logError("[bot] failed to send error reply", replyError, {
      updateId: ctx.update.update_id,
      chatId: ctx.chatId,
    });
  }
});

async function main() {
  console.log(`[bot] update mode: ${updateMode}`);

  await bot.api
    .getMe()
    .then(async (me) => {
      bot.setBotUsername(me.username);
      await bot.api.setMyCommands(BOT_COMMANDS);
      console.log(`[bot] running as @${me.username ?? me.id}`);
    })
    .catch((err) => {
      logError("[bot] failed to initialize bot metadata", err);
    });

  if (updateMode === "polling") {
    const polling = new PollingSource(bot.api, bot);

    const dropPending =
      process.env.DROP_PENDING_UPDATES === "true";

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
          logError("[webhook] failed to set", err, { webhookUrl });
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
  logError("[bot] fatal", err);
  process.exit(1);
});
