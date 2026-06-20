import { serve } from "@hono/node-server";
import { getEnv, getEnvOptional } from "@telegram-team/config";
import app from "./app.js";

function validateEnv(): void {
  const required = ["API_BASE_URL", "BOT_TOKEN", "MINIAPP_CONTEXT_SECRET"];
  const missing = required.filter((k) => !getEnvOptional(k));
  if (missing.length > 0) {
    console.error(`[miniapp] FATAL: missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
}

validateEnv();

const port = parseInt(getEnv("MINIAPP_PORT", getEnv("PORT", "3002")));

console.log(`[miniapp] starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
