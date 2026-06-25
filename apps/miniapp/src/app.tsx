import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { Layout } from "./views/layout.js";
import { tasksRoutes } from "./routes/tasks.js";
import { boardRoutes } from "./routes/board.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { teamRoutes } from "./routes/teams.js";
import { launchRoutes } from "./routes/launch.js";
import type { AppVariables } from "./auth/requireMiniAppUser.js";

const app = new Hono<{ Variables: AppVariables }>();

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

app.route("/app", launchRoutes);
app.route("/app", onboardingRoutes);
app.route("/app", tasksRoutes);
app.route("/app", boardRoutes);
app.route("/app", teamRoutes);

export default app;
