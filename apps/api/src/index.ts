import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createDb } from "@telegram-team/db";
import { healthRouter } from "./routes/health.js";
import { tasksRouter } from "./routes/tasks.js";
import { teamsRouter } from "./routes/teams.js";
import { usersRouter } from "./routes/users.js";
import { internalRouter } from "./routes/internal.js";
import { getEnv, getEnvOptional } from "@telegram-team/config";
import { createLogger } from "@telegram-team/shared";

const log = createLogger("api");

function validateEnv(): void {
  const required = ["INTERNAL_API_KEY"];
  const missing = required.filter((k) => !getEnvOptional(k));
  if (missing.length > 0) {
    log.error("missing required env vars", new Error(missing.join(", ")));
    process.exit(1);
  }
}

validateEnv();

const app = new Hono();

app.use("*", (c, next) => {
  const start = Date.now();
  const requestId = c.req.header("X-Request-Id") ?? "N/A";
  const path = c.req.path;
  const method = c.req.method;
  return next().then(() => {
    const duration = Date.now() - start;
    if (path !== "/health" && path !== "/ready") {
      log.info(`${method} ${path}`, {
        status: c.res.status,
        durationMs: duration,
        requestId,
      });
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

log.info(`starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
