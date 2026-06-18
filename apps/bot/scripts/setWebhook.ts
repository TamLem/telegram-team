import { getEnv, getEnvOptional } from "@telegram-team/config";
import { TelegramApi } from "@telegram-team/bot-engine";
import { BOT_COMMANDS } from "../src/interactions.js";
import { logError } from "../src/logger.js";

const token = getEnv("BOT_TOKEN");
const webhookUrl = getEnv("BOT_WEBHOOK_URL");
const secretToken = getEnvOptional("BOT_WEBHOOK_SECRET");

const api = new TelegramApi(token);

api
  .setWebhook(webhookUrl, secretToken)
  .then(async () => {
    await api.setMyCommands(BOT_COMMANDS);
  })
  .then(() => {
    console.log(`Webhook set to: ${webhookUrl}`);
    if (secretToken) {
      console.log("Secret token configured.");
    }
  })
  .catch((err) => {
    logError("[telegram:set-webhook] failed", err, { webhookUrl });
    process.exit(1);
  });
