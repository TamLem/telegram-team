import test from "node:test";
import assert from "node:assert/strict";

process.env.BOT_TOKEN = process.env.BOT_TOKEN || "123456:test-token";
process.env.MINIAPP_CONTEXT_SECRET =
  process.env.MINIAPP_CONTEXT_SECRET || "test-context-secret";
process.env.BOT_USERNAME = "taskipi_bot";

const { default: app } = await import("./app.js");
const { createMiniAppSessionCookie, SESSION_COOKIE } = await import(
  "./auth/requireMiniAppUser.js"
);

test("GET / serves branded landing when unauthenticated", async () => {
  const response = await app.request("/");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /TaskPi/);
  assert.match(body, /Open app/);
  assert.match(body, /href="\/app"/);
  assert.match(body, /taskipi_bot/);
  assert.match(body, /telegram-widget\.js/);
});

test("GET / redirects to /app when session cookie is valid", async () => {
  const cookie = createMiniAppSessionCookie({
    id: 42,
    first_name: "Ada",
  });
  const response = await app.request("/?from=root", {
    headers: { Cookie: `${SESSION_COOKIE}=${cookie}` },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/app?from=root");
});

test("unknown path returns friendly HTML 404", async () => {
  const response = await app.request("/nope");
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(body, /Page not found/);
  assert.match(body, /href="\/app"/);
});

test("GET /health still returns JSON", async () => {
  const response = await app.request("/health");
  const body = (await response.json()) as { status: string };

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
});
