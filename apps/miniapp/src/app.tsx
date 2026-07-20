import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { jsxRenderer } from "hono/jsx-renderer";
import { getEnvOptional } from "@telegram-team/config";
import { createLogger } from "@telegram-team/shared";
import { Layout } from "./views/layout.js";
import {
  renderHomeLandingPage,
  renderNotFoundPage,
} from "./views/homeLanding.js";
import { tasksRoutes } from "./routes/tasks.js";
import { boardRoutes } from "./routes/board.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { teamRoutes } from "./routes/teams.js";
import { launchRoutes } from "./routes/launch.js";
import { choresRoutes } from "./routes/chores.js";
import {
  peekMiniAppSession,
  SESSION_COOKIE,
  type AppVariables,
} from "./auth/requireMiniAppUser.js";
import { blockProbes, isProbePath } from "./middleware/blockProbes.js";
import { rateLimit } from "./middleware/rateLimit.js";

const log = createLogger("miniapp");
const app = new Hono<{ Variables: AppVariables }>();

const rateLimitWindowMs = parsePositiveInt(
  getEnvOptional("MINIAPP_RATE_LIMIT_WINDOW_MS"),
  60_000
);
const rateLimitMax = parsePositiveInt(
  getEnvOptional("MINIAPP_RATE_LIMIT_MAX"),
  120
);
const authRateLimitMax = parsePositiveInt(
  getEnvOptional("MINIAPP_AUTH_RATE_LIMIT_MAX"),
  20
);

function parsePositiveInt(
  raw: string | undefined,
  fallback: number
): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function isHealthPath(path: string): boolean {
  return path === "/health" || path === "/ready";
}

function isAuthPath(path: string): boolean {
  return path === "/app/auth" || path.startsWith("/app/auth/");
}

/** Cheap security headers safe for Telegram WebView (no X-Frame-Options). */
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-DNS-Prefetch-Control", "off");
});

// Block scanner paths before rate-limit counters or HTML work.
app.use("*", blockProbes());

// Global per-IP budget (single replica in-memory).
app.use(
  "*",
  rateLimit({
    name: "global",
    max: rateLimitMax,
    windowMs: rateLimitWindowMs,
    skip: (c) => isHealthPath(new URL(c.req.url).pathname),
  })
);

// Tighter budget on auth endpoints (initData / Login Widget).
app.use(
  "*",
  rateLimit({
    name: "auth",
    max: authRateLimitMax,
    windowMs: rateLimitWindowMs,
    skip: (c) => !isAuthPath(new URL(c.req.url).pathname),
  })
);

app.use("*", (c, next) => {
  const start = Date.now();
  const path = c.req.path;
  const method = c.req.method;
  return next().then(() => {
    if (isHealthPath(path)) return;
    const status = c.res.status;
    // Scanners and missing pages flood logs; keep signal for real traffic.
    if (status === 404 || status === 429) return;
    if (isProbePath(path)) return;
    const duration = Date.now() - start;
    log.info(`${method} ${path}`, {
      status,
      durationMs: duration,
    });
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/ready", (c) => {
  return c.json({ status: "ready", timestamp: new Date().toISOString() });
});

/** Discourage crawlers — product is Telegram Mini App + optional Login Widget. */
app.get("/robots.txt", (c) => {
  return c.text("User-agent: *\nDisallow: /\n", 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
});

/**
 * Origin entrypoint for MINIAPP_BASE_URL (`/`).
 * Product UI lives under `/app`; root is a branded landing with Login Widget.
 * Signed-in visitors go straight into the app.
 */
app.get("/", (c) => {
  const session = peekMiniAppSession(getCookie(c, SESSION_COOKIE));
  if (session) {
    const search = new URL(c.req.url).search;
    return c.redirect(`/app${search}`);
  }

  const botUsername = getEnvOptional("BOT_USERNAME");
  return c.html(renderHomeLandingPage({ botUsername }));
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
      `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:var(--tg-theme-bg-color,#f5f5f5);color:var(--tg-theme-text-color,#222);text-align:center}</style><meta http-equiv="refresh" content="2;url=/app/onboarding"></head><body><div><h2>Reloading TaskPi...</h2><p>If nothing happens, <a href="/app/onboarding">tap here</a>.</p></div></body></html>`,
      500
    );
  }
});

app.route("/app", launchRoutes);
app.route("/app", onboardingRoutes);
app.route("/app", choresRoutes);
app.route("/app", tasksRoutes);
app.route("/app", boardRoutes);
app.route("/app", teamRoutes);

app.notFound((c) => {
  const path = c.req.path;
  // Minimal body for junk paths that slipped past the prefix blocklist.
  if (isProbePath(path) || path.includes("..")) {
    return c.text("Not Found", 404);
  }
  return c.html(renderNotFoundPage(), 404);
});

export default app;
