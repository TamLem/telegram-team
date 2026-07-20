import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createRateLimiter } from "./rateLimit.js";

test("rateLimit allows under max then returns 429", async () => {
  const { middleware } = createRateLimiter({
    name: "t1",
    max: 3,
    windowMs: 60_000,
    key: () => "ip-a",
  });
  const app = new Hono();
  app.use("*", middleware);
  app.get("/", (c) => c.text("ok"));

  for (let i = 0; i < 3; i++) {
    const res = await app.request("/");
    assert.equal(res.status, 200, `request ${i + 1}`);
  }
  const blocked = await app.request("/");
  assert.equal(blocked.status, 429);
  assert.equal(await blocked.text(), "Too Many Requests");
  assert.ok(blocked.headers.get("Retry-After"));
  assert.equal(blocked.headers.get("X-RateLimit-Limit"), "3");
  assert.equal(blocked.headers.get("X-RateLimit-Remaining"), "0");
});

test("rateLimit keys are independent per IP", async () => {
  const { middleware } = createRateLimiter({
    name: "t2",
    max: 1,
    windowMs: 60_000,
    key: (c) => c.req.header("x-real-ip") ?? "unknown",
  });
  const app = new Hono();
  app.use("*", middleware);
  app.get("/", (c) => c.text("ok"));

  assert.equal(
    (await app.request("/", { headers: { "x-real-ip": "1.1.1.1" } })).status,
    200
  );
  assert.equal(
    (await app.request("/", { headers: { "x-real-ip": "1.1.1.1" } })).status,
    429
  );
  assert.equal(
    (await app.request("/", { headers: { "x-real-ip": "2.2.2.2" } })).status,
    200
  );
});

test("rateLimit skip bypasses counting", async () => {
  const { middleware } = createRateLimiter({
    name: "t3",
    max: 1,
    windowMs: 60_000,
    key: () => "same",
    skip: (c) => c.req.path === "/health",
  });
  const app = new Hono();
  app.use("*", middleware);
  app.get("/health", (c) => c.text("h"));
  app.get("/", (c) => c.text("ok"));

  assert.equal((await app.request("/health")).status, 200);
  assert.equal((await app.request("/health")).status, 200);
  assert.equal((await app.request("/")).status, 200);
  assert.equal((await app.request("/")).status, 429);
});
