import { serve } from "@hono/node-server";
import {
  createBot,
  logMiddleware,
  requireUser,
  extractCommandArgs,
} from "@telegram-team/bot-engine";
import { getEnv, getEnvOptional } from "@telegram-team/config";
import { PollingSource } from "./updateSources/polling.js";
import { createWebhookApp } from "./updateSources/webhook.js";
import { BOT_COMMANDS, registerBotInteractions } from "./interactions.js";
import { NotificationPoller } from "./notifications/poller.js";
import { DeadlinePoller } from "./notifications/deadlinePoller.js";
import { logError, log } from "./logger.js";
import { miniAppRootUrl } from "./telegram/webApp.js";

function validateEnv(): void {
  const required = [
    "BOT_TOKEN",
    "API_BASE_URL",
    "MINIAPP_BASE_URL",
    "MINIAPP_CONTEXT_SECRET",
    "INTERNAL_API_KEY",
  ];
  const missing = required.filter((k) => !getEnvOptional(k));
  if (missing.length > 0) {
    log.error("missing required env vars", new Error(missing.join(", ")));
    process.exit(1);
  }
}

validateEnv();

const botToken = getEnv("BOT_TOKEN");
const updateMode = getEnv("BOT_UPDATE_MODE", "polling");

const bot = createBot(botToken);

let pollingRef: PollingSource | null = null;

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
  log.info(`update mode: ${updateMode}`);

  await bot.api
    .getMe()
    .then(async (me) => {
      bot.setBotUsername(me.username);
      await bot.api.setMyCommands(BOT_COMMANDS);
      await bot.api.setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "Open TaskPi",
          web_app: {
            url: miniAppRootUrl(getEnv("MINIAPP_BASE_URL")),
          },
        },
      }).catch((err: unknown) => {
        log.warn("failed to set global menu button", { err: String(err) });
      });
      bot.setBotUsername(me.username);
      await bot.api.setMyCommands(BOT_COMMANDS);
      log.info(`running as @${me.username ?? me.id}`);
    })
    .catch((err) => {
      logError("[bot] failed to initialize bot metadata", err);
    });

  const poller = new NotificationPoller(bot);
  poller.start();

  const deadlinePoller = new DeadlinePoller();
  deadlinePoller.start();

  process.on("SIGINT", () => {
    poller.stop();
    deadlinePoller.stop();
    pollingRef?.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    poller.stop();
    deadlinePoller.stop();
    pollingRef?.stop();
    process.exit(0);
  });

  if (updateMode === "polling") {
    const polling = new PollingSource(bot.api, bot);
    pollingRef = polling;

    const dropPending = getEnvOptional("DROP_PENDING_UPDATES") === "true";
    const allowedUpdates = parseListEnv(getEnvOptional("BOT_ALLOWED_UPDATES"), [
      "message",
      "callback_query",
    ]);
    const pollTimeout = parsePositiveIntegerEnv("BOT_POLL_TIMEOUT_SECONDS", 30);
    const maxUpdateFailures = parsePositiveIntegerEnv(
      "BOT_MAX_UPDATE_FAILURES",
      3,
    );
    const retryDelayMs = parsePositiveIntegerEnv("BOT_RETRY_DELAY_MS", 5_000);
    const handlerTimeoutMs = parsePositiveIntegerEnv(
      "BOT_HANDLER_TIMEOUT_MS",
      25_000,
    );
    const requestTimeoutMs = parsePositiveIntegerEnv(
      "BOT_GET_UPDATES_REQUEST_TIMEOUT_MS",
      (pollTimeout + 5) * 1000,
    );

    await polling.start({
      dropPendingUpdates: dropPending,
      allowedUpdates,
      pollTimeout,
      maxUpdateFailures,
      retryDelayMs,
      handlerTimeoutMs,
      requestTimeoutMs,
    });
    return;
  }

  if (updateMode === "webhook") {
    const webhookSecret = getEnvOptional("BOT_WEBHOOK_SECRET");
    const port = parseInt(getEnv("BOT_PORT", getEnv("PORT", "3000")));
    const publicUrl = getEnvOptional("BOT_WEBHOOK_URL");
    const handlerTimeoutMs = parsePositiveIntegerEnv(
      "BOT_HANDLER_TIMEOUT_MS",
      25_000,
    );

    const app = createWebhookApp(bot, {
      secretToken: webhookSecret,
      path: "/telegram/webhook",
      handlerTimeoutMs,
    });

    if (publicUrl) {
      const webhookUrl = `${publicUrl}/telegram/webhook`;
      await bot.api
        .setWebhook(webhookUrl, webhookSecret)
        .then(() => {
          log.info(`webhook set`, { url: webhookUrl });
        })
        .catch((err) => {
          logError("[webhook] failed to set", err, { webhookUrl });
        });
    }

    log.info(`webhook server listening on port ${port}`);

    serve({ fetch: app.fetch, port });
    return;
  }

  log.error("invalid BOT_UPDATE_MODE", new Error(`"${updateMode}". Use "polling" or "webhook".`));
  process.exit(1);
}

main().catch((err) => {
  logError("[bot] fatal", err);
  process.exit(1);
});

function parseListEnv(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function parsePositiveIntegerEnv(key: string, fallback: number): number {
  const value = getEnvOptional(key);
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${key}: expected a positive integer`);
  }
  return parsed;
}
