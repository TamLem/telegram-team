import test from "node:test";
import assert from "node:assert/strict";
import { shouldBootstrapMiniAppSession } from "./requireMiniAppUser.js";

test("Mini App re-authenticates when a different Telegram user opens an action link", () => {
  assert.equal(shouldBootstrapMiniAppSession(1001, 2002), true);
});

test("Mini App reuses a session only for the context owner", () => {
  assert.equal(shouldBootstrapMiniAppSession(1001, 1001), false);
  assert.equal(shouldBootstrapMiniAppSession(undefined, 1001), true);
});
