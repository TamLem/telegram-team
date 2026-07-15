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
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
const ACTIVE_TEAM_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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

function renderBootstrapPage(ctxToken: string | undefined, returnTo: string): Response {
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<title>Opening Task Manager</title>
</head>
<body>
<script>
(async function () {
	  var app = window.Telegram && window.Telegram.WebApp;
	  var ctx = ${JSON.stringify(ctxToken ?? "")};
	  var returnTo = ${JSON.stringify(safeAppPath(returnTo))};
  if (!app || !app.initData) {
    document.body.textContent = "Open this app from Telegram.";
    return;
  }
  try {
    var res = await fetch("/app/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
	        initData: app.initData,
	        ctx: ctx,
	        returnTo: returnTo,
      }),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      document.body.textContent = err.error || "Authentication failed.";
      return;
    }
    var data = await res.json();
    window.location.href = data.redirect;
  } catch (e) {
    document.body.textContent = "Connection error. Please try again.";
  }
})();
</script>
</body>
</html>`;
  return new Response(body, {
    headers: { "content-type": "text/html; charset=UTF-8" },
  });
}

export function setActiveTeam(c: any, teamId: string): void {
  setCookie(c, ACTIVE_TEAM_COOKIE, signedValue(teamId), {
    httpOnly: true,
    secure: getEnvOptional("NODE_ENV") === "production",
    sameSite: "Lax",
    path: "/app",
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

    if (
      refreshStandaloneIdentity ||
      !sessionUser ||
      (ctx && shouldBootstrapMiniAppSession(sessionUser.id, ctx.telegramUserId))
    ) {
      if (refreshStandaloneIdentity) {
        requestUrl.searchParams.set("authenticated", "1");
      }
      return renderBootstrapPage(
        ctxToken,
        `${requestUrl.pathname}${requestUrl.search}`
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
  app.post("/auth", async (c) => {
    const body = await c.req.json<{
      initData: string;
      ctx?: string;
      returnTo?: string;
    }>();

    const ctx = body.ctx
      ? verifySignedMiniAppContext(body.ctx)
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

    setCookie(c, SESSION_COOKIE, createMiniAppSessionCookie(result.user), {
      httpOnly: true,
      secure: getEnvOptional("NODE_ENV") === "production",
      sameSite: "Lax",
      path: "/app",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    const redirectPath = ctx
      ? actionToPath(ctx)
      : safeAppPath(body.returnTo);
    const separator = redirectPath.includes("?") ? "&" : "?";
    return c.json({
      redirect: ctx && body.ctx
        ? `${redirectPath}${separator}ctx=${body.ctx}`
        : redirectPath,
    });
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
      return "/app/chores";
    case "view_chore":
      return ctx.choreId ? `/app/chores/${ctx.choreId}` : "/app/chores";
    default:
      return `/app/board/${ctx.teamId}?assignee=me`;
  }
}

export {
  ACTIVE_TEAM_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
};
