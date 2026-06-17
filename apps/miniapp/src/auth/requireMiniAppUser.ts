import type { MiddlewareHandler } from "hono";
import { validateTelegramInitData, type TelegramUser } from "./validateTelegramInitData.js";
import { getOrCreateUser } from "../services/apiClient.js";

export interface AppVariables {
  telegramUser: TelegramUser;
  apiUser: { id: string };
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
      } catch {
        c.set("apiUser", { id: "dev-user-id" });
      }

      return next();
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

    c.set("telegramUser", result.user);

    try {
      const apiUser = await getOrCreateUser(result.user.id, {
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        username: result.user.username,
      });
      c.set("apiUser", { id: apiUser.id });
    } catch (err) {
      console.error("[miniapp] user sync error:", err);
      return c.json({ error: "Failed to sync user" }, 500);
    }

    return next();
  };
}
