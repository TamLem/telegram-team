import test from "node:test";
import assert from "node:assert/strict";
import {
  createSignedMiniAppContext,
  MINIAPP_CONTEXT_DEFAULT_TTL_SECONDS,
  verifySignedMiniAppContext,
} from "./miniAppContext.js";

process.env.MINIAPP_CONTEXT_SECRET = "test-miniapp-context-secret";

test("Mini App action links remain valid across browser sessions", () => {
  const before = Math.floor(Date.now() / 1000);
  const token = createSignedMiniAppContext({
    action: "onboard_join_team",
    telegramUserId: 1001,
    returnChatId: 1001,
  });
  const context = verifySignedMiniAppContext(token);

  assert.ok(context);
  assert.equal(context.telegramUserId, 1001);
  assert.ok(
    context.expiresAt >= before + MINIAPP_CONTEXT_DEFAULT_TTL_SECONDS
  );
});
