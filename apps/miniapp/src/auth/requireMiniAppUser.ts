import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv, getEnvOptional } from "@telegram-team/config";
import {
  verifySignedMiniAppContext,
  createLogger,
  type MiniAppContext,
} from "@telegram-team/shared";
import { validateTelegramInitData, type TelegramUser } from "./validateTelegramInitData.js";
import { validateTelegramLoginWidget } from "./validateTelegramLoginWidget.js";
import { getOrCreateUser, getUserTeams } from "../services/apiClient.js";

const log = createLogger("miniapp");

export interface AppVariables {
  telegramUser: TelegramUser;
  apiUser: { id: string };
  ctx?: MiniAppContext;
  teams: Array<{ id: string; name: string; role: string }>;
  preferredTeamId?: string | null;
  activeTeamId?: string;
}

const SESSION_COOKIE = "ttp_session";
const ACTIVE_TEAM_COOKIE = "ttp_active_team";
/** Cookie path is `/` so origin landing (`/`) can detect an existing session. */
const COOKIE_PATH = "/";
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
const ACTIVE_TEAM_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** Login Widget auth_date max age (Telegram recommends checking freshness). */
const LOGIN_WIDGET_MAX_AGE_SECONDS = 24 * 60 * 60;

interface MiniAppSession {
  user: TelegramUser;
  issuedAt: number;
}

export function shouldBootstrapMiniAppSession(
  sessionTelegramUserId: number | undefined,
  contextTelegramUserId: number
): boolean {
  return sessionTelegramUserId === undefined ||
    sessionTelegramUserId !== contextTelegramUserId;
}

export function shouldRefreshStandaloneIdentity(
  pathname: string,
  authenticated: string | null,
  hasContext: boolean
): boolean {
  return pathname === "/app" && !hasContext && authenticated !== "1";
}

function sessionSecret(): string {
  return (
    getEnvOptional("MINIAPP_CONTEXT_SECRET") ??
    getEnvOptional("MINIAPP_SESSION_SECRET") ??
    getEnv("BOT_TOKEN")
  );
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function signedValue(value: string): string {
  return `${value}.${sign(value, sessionSecret())}`;
}

function readSignedValue(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const dotIndex = cookie.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  const value = cookie.slice(0, dotIndex);
  const signature = cookie.slice(dotIndex + 1);
  const expected = sign(value, sessionSecret());
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }
  return value;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createMiniAppSessionCookie(user: TelegramUser): string {
  const secret = sessionSecret();
  const payload = encodeBase64Url(
    JSON.stringify({
      user,
      issuedAt: Math.floor(Date.now() / 1000),
    } satisfies MiniAppSession)
  );
  return `${payload}.${sign(payload, secret)}`;
}

function readMiniAppSessionCookie(
  cookie: string | undefined
): TelegramUser | null {
  const secret = sessionSecret();
  if (!cookie || !secret) return null;

  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(decodeBase64Url(payload)) as MiniAppSession;
    const now = Math.floor(Date.now() / 1000);
    if (
      !session.user?.id ||
      !session.user.first_name ||
      !session.issuedAt ||
      now - session.issuedAt > SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }
    return session.user;
  } catch (err) {
    log.warn("[session] invalid cookie", { err: String(err) });
    return null;
  }
}

async function attachTelegramUser(c: any, telegramUser: TelegramUser) {
  c.set("telegramUser", telegramUser);

  const apiUser = await getOrCreateUser(telegramUser.id, {
    firstName: telegramUser.first_name,
    lastName: telegramUser.last_name,
    username: telegramUser.username,
  });
  c.set("apiUser", { id: apiUser.id });

  try {
    const { teams, preferredTeamId } = await getUserTeams(apiUser.id);
    c.set("teams", teams);
    c.set("preferredTeamId", preferredTeamId);
  } catch (err) {
    log.error("[attachUser] getUserTeams failed", err, { userId: apiUser.id });
    c.set("teams", []);
    c.set("preferredTeamId", null);
  }
}

function safeAppPath(value: string | undefined): string {
  if (!value || !value.startsWith("/app") || value.startsWith("//")) {
    return "/app";
  }
  return value;
}

function botUsernameForWidget(): string | undefined {
  const raw = getEnvOptional("BOT_USERNAME");
  if (!raw) return undefined;
  return raw.replace(/^@/, "").trim() || undefined;
}

function renderBootstrapPage(
  ctxToken: string | undefined,
  returnTo: string,
  options: { hasSession?: boolean } = {}
): Response {
  const botUsername = botUsernameForWidget();
  const safeReturn = safeAppPath(returnTo);
  const hasSession = Boolean(options.hasSession);
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<title>Sign in — TaskPi</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--tg-theme-bg-color, #f5f5f5);
    color: var(--tg-theme-text-color, #1e293b);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: var(--tg-theme-secondary-bg-color, #fff);
    border-radius: 16px;
    padding: 32px 28px;
    max-width: 360px;
    width: 100%;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    border: 1px solid rgba(0,0,0,0.06);
  }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  p { font-size: 14px; color: var(--tg-theme-hint-color, #64748b); margin-bottom: 20px; line-height: 1.45; }
  #status { font-size: 14px; color: var(--tg-theme-hint-color, #64748b); min-height: 1.4em; margin-bottom: 12px; }
  #status.error { color: #dc2626; }
  #widget { display: none; margin-top: 8px; }
  #widget.visible { display: block; }
  .hint { font-size: 12px; color: #94a3b8; margin-top: 16px; line-height: 1.4; }
  a { color: var(--tg-theme-link-color, #3390ec); }
</style>
</head>
<body>
<div class="card">
  <h1>TaskPi</h1>
  <p id="lead">Signing you in…</p>
  <div id="status"></div>
  <div id="widget"></div>
  <p class="hint" id="hint" hidden></p>
</div>
<script>
(function () {
  var ctx = ${JSON.stringify(ctxToken ?? "")};
  var returnTo = ${JSON.stringify(safeReturn)};
  var botUsername = ${JSON.stringify(botUsername ?? "")};
  var hasSession = ${JSON.stringify(hasSession)};
  var statusEl = document.getElementById("status");
  var leadEl = document.getElementById("lead");
  var widgetEl = document.getElementById("widget");
  var hintEl = document.getElementById("hint");

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.className = isError ? "error" : "";
  }

  function continueWithSession() {
    window.location.replace(returnTo);
  }

  function showWebLogin(message) {
    leadEl.textContent = message || "Sign in with Telegram to continue.";
    setStatus("");
    if (!botUsername) {
      setStatus("Web login is not configured (missing BOT_USERNAME).", true);
      hintEl.hidden = false;
      hintEl.innerHTML = "Open the app from Telegram, or set <code>BOT_USERNAME</code> and authorize your domain with @BotFather → /setdomain.";
      return;
    }
    widgetEl.className = "visible";
    widgetEl.innerHTML = "";
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.setAttribute("data-telegram-login", botUsername);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "8");
    s.setAttribute("data-request-access", "write");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    widgetEl.appendChild(s);
    hintEl.hidden = false;
    hintEl.textContent = "Uses Telegram Login via @" + botUsername + ". Domain must be authorized in BotFather.";
  }

  async function completeAuth(body) {
    setStatus("Completing sign-in…");
    try {
      var res = await fetch(body.initData ? "/app/auth" : "/app/auth/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        setStatus(err.error || "Authentication failed.", true);
        if (!body.initData) showWebLogin("Sign in with Telegram to continue.");
        return;
      }
      var data = await res.json();
      window.location.href = data.redirect;
    } catch (e) {
      setStatus("Connection error. Please try again.", true);
      if (!body.initData) showWebLogin("Sign in with Telegram to continue.");
    }
  }

  window.onTelegramAuth = function (user) {
    completeAuth({
      login: user,
      ctx: ctx || undefined,
      returnTo: returnTo,
    });
  };

  (async function () {
    var app = window.Telegram && window.Telegram.WebApp;
    if (app && app.initData) {
      try { app.ready && app.ready(); } catch (e) {}
      await completeAuth({
        initData: app.initData,
        ctx: ctx || undefined,
        returnTo: returnTo,
      });
      return;
    }
    // Outside Telegram WebApp: reuse cookie session when present,
    // otherwise show Telegram Login Widget for browser access.
    if (hasSession) {
      continueWithSession();
      return;
    }
    showWebLogin("Sign in with Telegram to continue.");
  })();
})();
</script>
</body>
</html>`;
  return new Response(body, {
    headers: { "content-type": "text/html; charset=UTF-8" },
  });
}

function issueSessionAndRedirect(
  c: any,
  user: TelegramUser,
  ctx: MiniAppContext | undefined,
  ctxToken: string | undefined,
  returnTo: string | undefined
) {
  setCookie(c, SESSION_COOKIE, createMiniAppSessionCookie(user), {
    httpOnly: true,
    secure: getEnvOptional("NODE_ENV") === "production",
    sameSite: "Lax",
    path: COOKIE_PATH,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const redirectPath = ctx ? actionToPath(ctx) : safeAppPath(returnTo);
  const separator = redirectPath.includes("?") ? "&" : "?";
  return {
    redirect:
      ctx && ctxToken
        ? `${redirectPath}${separator}ctx=${ctxToken}`
        : redirectPath,
  };
}

export function setActiveTeam(c: any, teamId: string): void {
  setCookie(c, ACTIVE_TEAM_COOKIE, signedValue(teamId), {
    httpOnly: true,
    secure: getEnvOptional("NODE_ENV") === "production",
    sameSite: "Lax",
    path: COOKIE_PATH,
    maxAge: ACTIVE_TEAM_MAX_AGE_SECONDS,
  });
  c.set("activeTeamId", teamId);
}

export function requireMiniAppUser(): MiddlewareHandler<{
  Variables: AppVariables;
}> {
  return async (c, next) => {
    const ctxToken = c.req.query("ctx");
    const requestUrl = new URL(c.req.url);
    const ctx = ctxToken
      ? verifySignedMiniAppContext(ctxToken) ?? undefined
      : undefined;

    if (ctxToken && !ctx) {
      return c.html(
        `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" /><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:24px;background:var(--tg-theme-bg-color,#fff);color:var(--tg-theme-text-color,#1e293b);text-align:center}p{margin:12px 0;color:var(--tg-theme-hint-color,#64748b)}a{display:inline-block;margin-top:16px;padding:10px 24px;background:var(--tg-theme-button-color,#3390ec);color:var(--tg-theme-button-text-color,#fff);text-decoration:none;border-radius:8px;font-weight:600}</style><title>Link Expired</title></head><body><h2>Link Expired</h2><p>This action link is invalid or expired.<br/>Please open it again from Telegram.</p><a href="https://t.me/TaskManagerBot">Open Bot</a></body></html>`,
        403
      );
    }

    const sessionUser = readMiniAppSessionCookie(getCookie(c, SESSION_COOKIE));
    const refreshStandaloneIdentity = shouldRefreshStandaloneIdentity(
      requestUrl.pathname,
      requestUrl.searchParams.get("authenticated"),
      Boolean(ctx)
    );

    const needsSession =
      !sessionUser ||
      (ctx && shouldBootstrapMiniAppSession(sessionUser.id, ctx.telegramUserId));
    // Menu launches re-read Telegram identity once; web browsers with a
    // valid cookie skip the Login Widget via hasSession on the bootstrap page.
    if (needsSession || refreshStandaloneIdentity) {
      if (refreshStandaloneIdentity) {
        requestUrl.searchParams.set("authenticated", "1");
      }
      return renderBootstrapPage(
        ctxToken,
        `${requestUrl.pathname}${requestUrl.search}`,
        { hasSession: Boolean(sessionUser) && !needsSession }
      );
    }

    try {
      await attachTelegramUser(c, sessionUser);
    } catch (err) {
      console.error("[miniapp] user sync error:", err);
      return c.json({ error: "Failed to sync user" }, 500);
    }

    const teams = c.get("teams");
    const preferredTeamId = c.get("preferredTeamId");
    const requestedTeamId = ctx?.teamId;
    const cookieTeamId = readSignedValue(
      getCookie(c, ACTIVE_TEAM_COOKIE)
    );
    // Priority: signed action context → server preferred → cookie → first membership
    const activeTeamId =
      teams.find((team) => team.id === requestedTeamId)?.id ??
      teams.find((team) => team.id === preferredTeamId)?.id ??
      teams.find((team) => team.id === cookieTeamId)?.id ??
      teams[0]?.id;

    if (activeTeamId) {
      setActiveTeam(c, activeTeamId);
    }
    c.set("ctx", ctx);
    return next();
  };
}

import type { Hono } from "hono";

export function setupAuthRoutes(app: Hono<any>) {
  /** Mini App bootstrap: validates Telegram.WebApp.initData (HMAC WebAppData). */
  app.post("/auth", async (c) => {
    const body = await c.req.json<{
      initData: string;
      ctx?: string;
      returnTo?: string;
    }>();

    const ctx = body.ctx
      ? verifySignedMiniAppContext(body.ctx) ?? undefined
      : undefined;
    if (body.ctx && !ctx) {
      return c.json({ error: "Invalid or expired context" }, 403);
    }

    const botToken = getEnv("BOT_TOKEN");
    const result = validateTelegramInitData(body.initData ?? "", botToken);

    if (!result.valid || !result.user) {
      return c.json({ error: "Invalid Telegram init data" }, 403);
    }

    if (ctx && result.user.id !== ctx.telegramUserId) {
      return c.json(
        { error: "This action link belongs to another Telegram user." },
        403
      );
    }

    return c.json(
      issueSessionAndRedirect(c, result.user, ctx, body.ctx, body.returnTo)
    );
  });

  /**
   * Web browser login via Telegram Login Widget
   * (https://core.telegram.org/widgets/login).
   * Secret scheme: HMAC-SHA256(data, SHA256(bot_token)).
   */
  app.post("/auth/web", async (c) => {
    const body = await c.req.json<{
      login?: Record<string, unknown>;
      ctx?: string;
      returnTo?: string;
    }>();

    const ctx = body.ctx
      ? verifySignedMiniAppContext(body.ctx) ?? undefined
      : undefined;
    if (body.ctx && !ctx) {
      return c.json({ error: "Invalid or expired context" }, 403);
    }

    const login = body.login;
    if (!login || typeof login !== "object") {
      return c.json({ error: "Missing login payload" }, 400);
    }

    const botToken = getEnv("BOT_TOKEN");
    const result = validateTelegramLoginWidget(login, botToken, {
      maxAgeSeconds: LOGIN_WIDGET_MAX_AGE_SECONDS,
    });

    if (!result.valid || !result.user) {
      return c.json({ error: "Invalid Telegram login data" }, 403);
    }

    if (ctx && result.user.id !== ctx.telegramUserId) {
      return c.json(
        { error: "This action link belongs to another Telegram user." },
        403
      );
    }

    return c.json(
      issueSessionAndRedirect(c, result.user, ctx, body.ctx, body.returnTo)
    );
  });

  /**
   * Redirect-mode Login Widget callback.
   * Configure data-auth-url to /app/auth/web/callback (optional alternative to data-onauth).
   */
  app.get("/auth/web/callback", async (c) => {
    const q = c.req.query();
    const returnTo = q.returnTo;
    const ctxToken = q.ctx;
    const ctx = ctxToken
      ? verifySignedMiniAppContext(ctxToken) ?? undefined
      : undefined;
    if (ctxToken && !ctx) {
      return c.html(
        `<!doctype html><html><body style="font-family:system-ui;padding:24px;text-align:center"><h2>Link expired</h2><p>Please open the link again.</p><a href="/app">Home</a></body></html>`,
        403
      );
    }

    const login: Record<string, string> = {};
    for (const key of [
      "id",
      "first_name",
      "last_name",
      "username",
      "photo_url",
      "auth_date",
      "hash",
    ] as const) {
      const value = q[key];
      if (value !== undefined && value !== "") login[key] = value;
    }

    const botToken = getEnv("BOT_TOKEN");
    const result = validateTelegramLoginWidget(login, botToken, {
      maxAgeSeconds: LOGIN_WIDGET_MAX_AGE_SECONDS,
    });

    if (!result.valid || !result.user) {
      return c.html(
        `<!doctype html><html><body style="font-family:system-ui;padding:24px;text-align:center"><h2>Sign-in failed</h2><p>Could not verify Telegram login.</p><a href="${safeAppPath(returnTo)}">Try again</a></body></html>`,
        403
      );
    }

    if (ctx && result.user.id !== ctx.telegramUserId) {
      return c.html(
        `<!doctype html><html><body style="font-family:system-ui;padding:24px;text-align:center"><h2>Wrong account</h2><p>This link belongs to another Telegram user.</p></body></html>`,
        403
      );
    }

    const { redirect } = issueSessionAndRedirect(
      c,
      result.user,
      ctx,
      ctxToken,
      returnTo
    );
    return c.redirect(redirect);
  });
}

function actionToPath(ctx: MiniAppContext): string {
  switch (ctx.action) {
    case "create_task":
      return "/app/tasks/new";
    case "view_task":
      return `/app/tasks/${ctx.taskId}`;
    case "edit_task":
      return `/app/tasks/${ctx.taskId}/edit`;
    case "assign_task":
      return `/app/tasks/${ctx.taskId}/assign`;
    case "change_status":
      return `/app/tasks/${ctx.taskId}/status`;
    case "add_comment":
      return `/app/tasks/${ctx.taskId}/comment`;
    case "view_board":
      return `/app/board/${ctx.teamId}`;
    case "view_my_tasks":
      return `/app/board/${ctx.teamId}?assignee=me`;
    case "onboard_create_team":
      return "/app/onboarding/create-team";
    case "onboard_join_team":
      return "/app/onboarding/join-team";
    case "view_team":
      return "/app/team";
    case "view_members":
      return "/app/team/members";
    case "manage_invite":
      return "/app/team/invite";
    case "review_join_requests":
      return "/app/team/join-requests";
    case "team_settings":
      return "/app/team/settings";
    case "view_blocked_tasks":
      return `/app/board/${ctx.teamId}?status=blocked`;
    case "view_chores":
      // Team-scoped bot/menu links open the team board; default tab is Mine.
      return ctx.teamId ? "/app/chores?view=team" : "/app/chores?view=mine";
    case "view_chore":
      return ctx.choreId
        ? `/app/chores/${ctx.choreId}?view=mine`
        : "/app/chores?view=mine";
    default:
      return `/app/board/${ctx.teamId}?assignee=me`;
  }
}

/** Read a valid session user from the raw `ttp_session` cookie value (if any). */
export function peekMiniAppSession(
  cookie: string | undefined
): TelegramUser | null {
  return readMiniAppSessionCookie(cookie);
}

export {
  ACTIVE_TEAM_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
};
