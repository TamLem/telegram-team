import test from "node:test";
import assert from "node:assert/strict";
import { TelegramApi, TelegramApiError } from "./api.js";

test("TelegramApi wraps fetch failures with method details and cause", async () => {
  const originalFetch = globalThis.fetch;
  const cause = Object.assign(new Error("connect ETIMEDOUT"), {
    code: "ETIMEDOUT",
  });

  globalThis.fetch = (async () => {
    throw cause;
  }) as typeof fetch;

  try {
    const api = new TelegramApi("token");
    await assert.rejects(
      () => api.getUpdates(),
      (error) => {
        assert.equal(error instanceof TelegramApiError, true);
        assert.equal((error as TelegramApiError).details.method, "getUpdates");
        assert.equal((error as Error & { cause?: unknown }).cause, cause);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
