import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { createDb } from "@telegram-team/db";
import { healthRouter } from "./routes/health.js";
import { tasksRouter } from "./routes/tasks.js";
import { teamsRouter } from "./routes/teams.js";
import { usersRouter } from "./routes/users.js";
import { internalRouter } from "./routes/internal.js";
import { getEnv, getEnvOptional } from "@telegram-team/config";

function validateEnv(): void {
  const required = ["INTERNAL_API_KEY"];
  const missing = required.filter((k) => !getEnvOptional(k));
  if (missing.length > 0) {
    console.error(`[api] FATAL: missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
}

validateEnv();

const app = new Hono();

app.use("*", (c, next) => {
  const start = Date.now();
  const path = c.req.path;
  const method = c.req.method;
  return next().then(() => {
    const duration = Date.now() - start;
    if (path !== "/health" && path !== "/ready") {
      console.log(`[api] ${method} ${path} ${c.res.status} ${duration}ms`);
    }
  });
});

app.route("/", healthRouter);
app.route("/api", tasksRouter);
app.route("/api", teamsRouter);
app.route("/api", usersRouter);
app.route("/api", internalRouter);

const port = parseInt(getEnv("API_PORT", getEnv("PORT", "3001")));

createDb();

console.log(`[api] starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
