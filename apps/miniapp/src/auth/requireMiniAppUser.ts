import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { createHmac, timingSafeEqual } from "node:crypto";
import { validateTelegramInitData, type TelegramUser } from "./validateTelegramInitData.js";
import { getOrCreateUser, getUserTeams } from "../services/apiClient.js";

export interface AppVariables {
  telegramUser: TelegramUser;
  apiUser: { id: string };
  hasTeam: boolean;
  teams: Array<{ id: string; name: string; role: string }>;
}

const SESSION_COOKIE = "ttp_session";
const SESSION_MAX_AGE_SECONDS = 86_400;

interface MiniAppSession {
  user: TelegramUser;
  issuedAt: number;
}

function sessionSecret(): string {
  return process.env.MINIAPP_SESSION_SECRET ?? process.env.BOT_TOKEN ?? "";
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
  if (!secret) {
    throw new Error("Missing Mini App session secret");
  }

  const payload = encodeBase64Url(
    JSON.stringify({
      user,
      issuedAt: Math.floor(Date.now() / 1000),
    } satisfies MiniAppSession)
  );
  return `${payload}.${sign(payload, secret)}`;
}

function readMiniAppSessionCookie(cookie: string | undefined): TelegramUser | null {
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
    c.set("hasTeam", teams.length > 0);
  } catch {
    c.set("teams", []);
    c.set("hasTeam", false);
  }
}

export function requireMiniAppUser(): MiddlewareHandler<{
  Variables: AppVariables;
}> {
  return async (c, next) => {
    const initData =
      c.req.query("tgWebAppData") ??
      c.req.header("X-Telegram-Init-Data") ??
      "";

    const isDev = process.env.NODE_ENV !== "production";

    if (isDev && !initData) {
      const devUserId = parseInt(
        process.env.MINIAPP_DEV_USER_ID ?? "12345"
      );

      c.set("telegramUser", {
        id: devUserId,
        first_name: "Dev",
        username: "dev_user",
      });

      try {
        const apiUser = await getOrCreateUser(devUserId, {
          firstName: "Dev",
          username: "dev_user",
        });
        c.set("apiUser", { id: apiUser.id });

        try {
          const teams = await getUserTeams(apiUser.id);
          c.set("teams", teams);
          c.set("hasTeam", teams.length > 0);
        } catch {
          c.set("teams", []);
          c.set("hasTeam", false);
        }
      } catch {
        c.set("apiUser", { id: "dev-user-id" });
        c.set("teams", []);
        c.set("hasTeam", false);
      }

      return next();
    }

    const sessionUser = readMiniAppSessionCookie(getCookie(c, SESSION_COOKIE));
    if (sessionUser) {
      try {
        await attachTelegramUser(c, sessionUser);
        return next();
      } catch (err) {
        console.error("[miniapp] session user sync error:", err);
        return c.json({ error: "Failed to sync user" }, 500);
      }
    }

    if (!initData) {
      return c.json({ error: "Missing Telegram init data" }, 401);
    }

    const botToken = process.env.BOT_TOKEN ?? "";
    if (!botToken) {
      return c.json({ error: "Server misconfigured" }, 500);
    }

    const result = validateTelegramInitData(initData, botToken);

    if (!result.valid || !result.user) {
      return c.json({ error: "Invalid init data" }, 403);
    }

    try {
      await attachTelegramUser(c, result.user);
    } catch (err) {
      console.error("[miniapp] user sync error:", err);
      return c.json({ error: "Failed to sync user" }, 500);
    }

    return next();
  };
}

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS };
