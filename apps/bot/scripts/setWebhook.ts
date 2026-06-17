import { getEnv } from "@telegram-team/config";
import { TelegramApi } from "@telegram-team/bot-engine";

const token = getEnv("BOT_TOKEN");
const webhookUrl = getEnv("BOT_WEBHOOK_URL");
const secretToken = process.env.BOT_WEBHOOK_SECRET;

const api = new TelegramApi(token);

api
  .setWebhook(webhookUrl, secretToken)
  .then(() => {
    console.log(`Webhook set to: ${webhookUrl}`);
    if (secretToken) {
      console.log("Secret token configured.");
    }
  })
  .catch((err) => {
    console.error("Failed to set webhook:", err.message);
    process.exit(1);
  });
