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

test("TelegramApi aborts requests that exceed the configured timeout", async () => {
  const originalFetch = globalThis.fetch;
  let sawSignal = false;

  globalThis.fetch = (async (_input, init) => {
    const signal = init?.signal as AbortSignal | undefined;
    sawSignal = signal instanceof AbortSignal;

    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  }) as typeof fetch;

  try {
    const api = new TelegramApi("token", { requestTimeoutMs: 1 });
    await assert.rejects(
      () => api.getUpdates({ timeout: 30, requestTimeoutMs: 1 }),
      (error) => {
        assert.equal(error instanceof TelegramApiError, true);
        assert.equal((error as TelegramApiError).details.method, "getUpdates");
        assert.equal(sawSignal, true);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
