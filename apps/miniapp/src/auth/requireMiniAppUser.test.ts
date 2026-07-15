import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { Hono } from "hono";

process.env.BOT_TOKEN = "123456:test-token";
process.env.MINIAPP_CONTEXT_SECRET = "test-context-secret";
process.env.BOT_USERNAME = "test_bot";

const {
  setupAuthRoutes,
  shouldBootstrapMiniAppSession,
  shouldRefreshStandaloneIdentity,
} = await import("./requireMiniAppUser.js");

function signedInitData(user: { id: number; first_name: string }): string {
  const input = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.entries(input)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(process.env.BOT_TOKEN!)
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  const params = new URLSearchParams(input);
  params.set("hash", hash);
  return params.toString();
}

function signedLoginWidget(user: {
  id: number;
  first_name: string;
  username?: string;
}): Record<string, string> {
  const input: Record<string, string> = {
    id: String(user.id),
    first_name: user.first_name,
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  if (user.username) input.username = user.username;
  const dataCheckString = Object.entries(input)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHash("sha256").update(process.env.BOT_TOKEN!).digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  return { ...input, hash };
}

test("Mini App re-authenticates when a different Telegram user opens an action link", () => {
  assert.equal(shouldBootstrapMiniAppSession(1001, 2002), true);
});

test("Mini App reuses a session only for the context owner", () => {
  assert.equal(shouldBootstrapMiniAppSession(1001, 1001), false);
  assert.equal(shouldBootstrapMiniAppSession(undefined, 1001), true);
});

test("Mini App authentication works without signed action context", async () => {
  const app = new Hono();
  setupAuthRoutes(app);

  const response = await app.request("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      initData: signedInitData({ id: 1001, first_name: "Ada" }),
      returnTo: "/app",
    }),
  });
  const body = await response.json() as { redirect: string };

  assert.equal(response.status, 200);
  assert.equal(body.redirect, "/app");
  assert.match(response.headers.get("set-cookie") ?? "", /ttp_session=/);
});

test("standalone menu launches refresh the current Telegram identity once", () => {
  assert.equal(shouldRefreshStandaloneIdentity("/app", null, false), true);
  assert.equal(shouldRefreshStandaloneIdentity("/app", "1", false), false);
  assert.equal(shouldRefreshStandaloneIdentity("/app/tasks/1", null, false), false);
  assert.equal(shouldRefreshStandaloneIdentity("/app", null, true), false);
});

test("web Login Widget auth issues a session cookie", async () => {
  const app = new Hono();
  setupAuthRoutes(app);

  const response = await app.request("/auth/web", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login: signedLoginWidget({ id: 2002, first_name: "Grace", username: "hopper" }),
      returnTo: "/app/board/team-1",
    }),
  });
  const body = (await response.json()) as { redirect: string };

  assert.equal(response.status, 200);
  assert.equal(body.redirect, "/app/board/team-1");
  assert.match(response.headers.get("set-cookie") ?? "", /ttp_session=/);
});

test("web Login Widget auth rejects invalid hash", async () => {
  const app = new Hono();
  setupAuthRoutes(app);

  const login = signedLoginWidget({ id: 2002, first_name: "Grace" });
  login.first_name = "Eve";

  const response = await app.request("/auth/web", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, returnTo: "/app" }),
  });

  assert.equal(response.status, 403);
});

test("web Login Widget redirect callback sets session and redirects", async () => {
  const app = new Hono();
  setupAuthRoutes(app);

  const login = signedLoginWidget({ id: 3003, first_name: "Alan" });
  const params = new URLSearchParams({ ...login, returnTo: "/app" });
  const response = await app.request(`/auth/web/callback?${params.toString()}`);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/app");
  assert.match(response.headers.get("set-cookie") ?? "", /ttp_session=/);
});
