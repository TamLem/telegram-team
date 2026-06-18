import { getEnv } from "@telegram-team/config";
import { TelegramApi } from "@telegram-team/bot-engine";
import { logError } from "../src/logger.js";

const token = getEnv("BOT_TOKEN");
const api = new TelegramApi(token);

const dropPending =
  process.env.DROP_PENDING_UPDATES === "true";

api
  .deleteWebhook({ drop_pending_updates: dropPending })
  .then(() => {
    console.log("Webhook deleted.");
    if (dropPending) {
      console.log("Pending updates were also dropped.");
    }
  })
  .catch((err) => {
    logError("[telegram:delete-webhook] failed", err, { dropPending });
    process.exit(1);
  });
