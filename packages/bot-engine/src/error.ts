import type { Middleware } from "./middleware.js";
import type { TelegramUpdate, TelegramUser } from "./types.js";

export function logMiddleware(): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    const user = ctx.from;
    const userLabel = user
      ? `${user.first_name} (@${user.username ?? user.id})`
      : "unknown";

    const updateType = ctx.callbackQuery
      ? "callback_query"
      : ctx.message
        ? "message"
        : "other";

    const detail =
      updateType === "callback_query"
        ? ctx.callbackData
        : ctx.text;

    console.log(
      `[bot] <- ${updateType} from ${userLabel}: ${detail ?? "(no content)"}`
    );

    await next();

    console.log(`[bot] handled in ${Date.now() - start}ms`);
  };
}

export function requireUser(): Middleware {
  return async (ctx, next) => {
    if (!ctx.from) {
      console.log("[bot] update ignored: no user");
      return;
    }
    await next();
  };
}

export function extractCommandArgs(): Middleware {
  return async (ctx, next) => {
    if (ctx.text) {
      const parts = ctx.text.split(/\s+/);
      if (parts.length > 1 && parts[0].startsWith("/")) {
        const args = parts.slice(1).join(" ");
        ctx.setState("args", args);
      }
    }
    await next();
  };
}
