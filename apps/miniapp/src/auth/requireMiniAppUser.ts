import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv, getEnvOptional } from "@telegram-team/config";
import {
  verifySignedMiniAppContext,
  type MiniAppContext,
} from "@telegram-team/shared";
import { validateTelegramInitData, type TelegramUser } from "./validateTelegramInitData.js";
import { getOrCreateUser, getUserTeams } from "../services/apiClient.js";

export interface AppVariables {
  telegramUser: TelegramUser;
  apiUser: { id: string };
  ctx: MiniAppContext;
  teams: Array<{ id: string; name: string; role: string }>;
}

const SESSION_COOKIE = "ttp_session";
const SESSION_MAX_AGE_SECONDS = 15 * 60;

interface MiniAppSession {
  user: TelegramUser;
  issuedAt: number;
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
  } catch {
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
    const teams = await getUserTeams(apiUser.id);
    c.set("teams", teams);
  } catch {
    c.set("teams", []);
  }
}

function renderBootstrapPage(ctxToken: string): Response {
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
  var ctx = ${JSON.stringify(ctxToken)};
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

export function requireMiniAppContext(): MiddlewareHandler<{
  Variables: AppVariables;
}> {
  return async (c, next) => {
    const ctxToken = c.req.query("ctx") ?? "";

    if (!ctxToken) {
      return c.json({ error: "Missing context token" }, 400);
    }

    const ctx = verifySignedMiniAppContext(ctxToken);
    if (!ctx) {
      return c.html(
        `<!doctype html><html><body><p>This action link is invalid or expired. Please open it again from Telegram.</p></body></html>`,
        403
      );
    }

    const sessionUser = readMiniAppSessionCookie(getCookie(c, SESSION_COOKIE));

    if (!sessionUser) {
      return renderBootstrapPage(ctxToken);
    }

    if (sessionUser.id !== ctx.telegramUserId) {
      return c.html(
        `<!doctype html><html><body><p>This action link belongs to another Telegram user.</p></body></html>`,
        403
      );
    }

    try {
      await attachTelegramUser(c, sessionUser);
    } catch (err) {
      console.error("[miniapp] user sync error:", err);
      return c.json({ error: "Failed to sync user" }, 500);
    }

    c.set("ctx", ctx);
    return next();
  };
}

import type { Hono } from "hono";

export function setupAuthRoutes(app: Hono) {
  app.post("/auth", async (c) => {
    const body = await c.req.json<{ initData: string; ctx: string }>();

    const ctx = verifySignedMiniAppContext(body.ctx ?? "");
    if (!ctx) {
      return c.json({ error: "Invalid or expired context" }, 403);
    }

    const botToken = getEnv("BOT_TOKEN");
    const result = validateTelegramInitData(body.initData ?? "", botToken);

    if (!result.valid || !result.user) {
      return c.json({ error: "Invalid Telegram init data" }, 403);
    }

    if (result.user.id !== ctx.telegramUserId) {
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

    const redirectPath = actionToPath(ctx);
    return c.json({
      redirect: `${redirectPath}?ctx=${body.ctx}`,
    });
  });
}

function actionToPath(ctx: MiniAppContext): string {
  switch (ctx.action) {
    case "create_task":
      return "/app/tasks/new";
    case "view_task":
    case "edit_task":
    case "assign_task":
    case "change_status":
    case "add_comment":
      return `/app/tasks/${ctx.taskId}`;
    case "view_board":
      return `/app/board/${ctx.teamId}`;
    case "view_my_tasks":
      return "/app/tasks/mine";
    default:
      return "/app/tasks/mine";
  }
}

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS };
