import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { createLogger } from "@telegram-team/shared";
import { Layout } from "./views/layout.js";
import { tasksRoutes } from "./routes/tasks.js";
import { boardRoutes } from "./routes/board.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { teamRoutes } from "./routes/teams.js";
import { launchRoutes } from "./routes/launch.js";
import type { AppVariables } from "./auth/requireMiniAppUser.js";

const log = createLogger("miniapp");
const app = new Hono<{ Variables: AppVariables }>();

app.use("*", (c, next) => {
  const start = Date.now();
  const path = c.req.path;
  const method = c.req.method;
  return next().then(() => {
    const duration = Date.now() - start;
    if (path !== "/health" && path !== "/ready") {
      log.info(`${method} ${path}`, {
        status: c.res.status,
        durationMs: duration,
      });
    }
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/ready", (c) => {
  return c.json({ status: "ready", timestamp: new Date().toISOString() });
});

const appRenderer = jsxRenderer(({ children }) => {
  return <Layout>{children}</Layout>;
});

app.use("/app", appRenderer);
app.use("/app/*", appRenderer);

app.use("/app/*", async (c, next) => {
  try {
    await next();
  } catch (err) {
    log.error("[miniapp] unhandled error", err, {
      method: c.req.method,
      path: c.req.path,
    });
    return c.html(
      `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:var(--tg-theme-bg-color,#f5f5f5);color:var(--tg-theme-text-color,#222);text-align:center}</style></head><body><div><h1>Something went wrong</h1><p>Please try again or go back to Telegram.</p></div></body></html>`,
      500
    );
  }
});

app.route("/app", launchRoutes);
app.route("/app", onboardingRoutes);
app.route("/app", tasksRoutes);
app.route("/app", boardRoutes);
app.route("/app", teamRoutes);

export default app;
