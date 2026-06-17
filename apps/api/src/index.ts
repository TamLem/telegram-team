import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createDb } from "@telegram-team/db";
import { healthRouter } from "./routes/health.js";
import { tasksRouter } from "./routes/tasks.js";
import { teamsRouter } from "./routes/teams.js";
import { usersRouter } from "./routes/users.js";
import { getEnv } from "@telegram-team/config";

const app = new Hono();

app.route("/", healthRouter);
app.route("/api", tasksRouter);
app.route("/api", teamsRouter);
app.route("/api", usersRouter);

const port = parseInt(
  process.env.API_PORT ?? getEnv("PORT", "3001")
);

createDb();

console.log(`[api] starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
