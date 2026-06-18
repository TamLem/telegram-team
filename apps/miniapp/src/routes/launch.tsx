import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { html } from "hono/html";
import {
  createMiniAppSessionCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../auth/requireMiniAppUser.js";
import { validateTelegramInitData } from "../auth/validateTelegramInitData.js";

const launchRoutes = new Hono();

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/app/") || value.startsWith("//")) {
    return "/app/tasks/mine";
  }
  return value;
}

launchRoutes.get("/launch", (c) => {
  const next = safeNext(c.req.query("next"));
  return c.html(html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <title>Opening Task Manager</title>
      </head>
      <body>
        <form method="post" action="/app/session" id="launch-form">
          <input type="hidden" name="initData" id="init-data" />
          <input type="hidden" name="next" value="${next}" />
        </form>
        <script>
          const app = window.Telegram && window.Telegram.WebApp;
          if (app && app.initData) {
            document.getElementById("init-data").value = app.initData;
            document.getElementById("launch-form").submit();
          } else {
            document.body.textContent = "Open this app from Telegram.";
          }
        </script>
      </body>
    </html>`);
});

launchRoutes.post("/session", async (c) => {
  const body = await c.req.parseBody<{ initData: string; next: string }>();
  const botToken = process.env.BOT_TOKEN ?? "";
  if (!botToken) {
    return c.json({ error: "Server misconfigured" }, 500);
  }

  const result = validateTelegramInitData(body.initData ?? "", botToken);
  if (!result.valid || !result.user) {
    return c.json({ error: "Invalid init data" }, 403);
  }

  setCookie(c, SESSION_COOKIE, createMiniAppSessionCookie(result.user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/app",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return c.redirect(safeNext(body.next));
});

export { launchRoutes };
