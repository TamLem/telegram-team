import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { blockProbes, isProbePath } from "./blockProbes.js";

test("isProbePath catches common scanner targets", () => {
  assert.equal(isProbePath("/"), false);
  assert.equal(isProbePath("/app"), false);
  assert.equal(isProbePath("/app/tasks/new"), false);
  assert.equal(isProbePath("/health"), false);
  assert.equal(isProbePath("/.env"), true);
  assert.equal(isProbePath("/wp-admin"), true);
  assert.equal(isProbePath("/wp-login.php"), true);
  assert.equal(isProbePath("/foo/bar.php"), true);
  assert.equal(isProbePath("/backup.sql"), true);
  assert.equal(isProbePath("/.git/config"), true);
  assert.equal(isProbePath("/WP-Admin"), true);
});

test("blockProbes middleware returns plain 404", async () => {
  const app = new Hono();
  app.use("*", blockProbes());
  app.get("/app", (c) => c.text("app"));

  const blocked = await app.request("/.env");
  assert.equal(blocked.status, 404);
  assert.equal(await blocked.text(), "Not Found");

  const ok = await app.request("/app");
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "app");
});
