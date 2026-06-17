import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { Layout } from "./views/layout.js";
import { tasksRoutes } from "./routes/tasks.js";
import { boardRoutes } from "./routes/board.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import type { AppVariables } from "./auth/requireMiniAppUser.js";

const app = new Hono<{ Variables: AppVariables }>();

app.get(
  "*",
  jsxRenderer(({ children }) => {
    return <Layout>{children}</Layout>;
  })
);

app.route("/app", onboardingRoutes);
app.route("/app", tasksRoutes);
app.route("/app", boardRoutes);

export default app;
