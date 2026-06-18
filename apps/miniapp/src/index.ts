import { serve } from "@hono/node-server";
import { getEnv } from "@telegram-team/config";
import app from "./app.js";

const port = parseInt(getEnv("MINIAPP_PORT", getEnv("PORT", "3002")));

console.log(`[miniapp] starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
