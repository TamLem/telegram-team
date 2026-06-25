import { serve } from "@hono/node-server";
import { getEnv, getEnvOptional } from "@telegram-team/config";
import { createLogger } from "@telegram-team/shared";
import app from "./app.js";

const log = createLogger("miniapp");

function validateEnv(): void {
  const required = ["API_BASE_URL", "BOT_TOKEN", "MINIAPP_CONTEXT_SECRET"];
  const missing = required.filter((k) => !getEnvOptional(k));
  if (missing.length > 0) {
    log.error("missing required env vars", new Error(missing.join(", ")));
    process.exit(1);
  }
}

validateEnv();

const port = parseInt(getEnv("MINIAPP_PORT", getEnv("PORT", "3002")));

log.info(`starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
