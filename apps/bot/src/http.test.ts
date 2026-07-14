import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithTimeout, HttpTimeoutError } from "./http.js";

test("fetchWithTimeout aborts hung requests", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      signal.addEventListener("abort", () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  };

  try {
    await assert.rejects(
      () =>
        fetchWithTimeout("https://example.invalid/hang", {
          timeoutMs: 20,
        }),
      (error: unknown) =>
        error instanceof HttpTimeoutError &&
        error.message.includes("timed out after 20ms")
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
