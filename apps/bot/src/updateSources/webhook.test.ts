import test from "node:test";
import assert from "node:assert/strict";
import { createWebhookApp } from "./webhook.js";

test("webhook times out hung update handlers", async () => {
  const bot = {
    handleUpdate: async () => new Promise(() => {}),
  };

  const app = createWebhookApp(bot as any, {
    handlerTimeoutMs: 30,
    path: "/telegram/webhook",
  });

  const res = await app.request("/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: 42,
      message: {
        message_id: 1,
        date: 1,
        chat: { id: 1, type: "private" },
        text: "/start",
      },
    }),
  });

  assert.equal(res.status, 500);
  const body = (await res.json()) as { error?: string };
  assert.match(body.error ?? "", /timed out/i);
});

test("webhook returns ok for successful handlers", async () => {
  const bot = {
    handleUpdate: async () => ({ ok: true }),
  };

  const app = createWebhookApp(bot as any, { path: "/telegram/webhook" });

  const res = await app.request("/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: 1,
      message: {
        message_id: 1,
        date: 1,
        chat: { id: 1, type: "private" },
        text: "/help",
      },
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok?: boolean };
  assert.equal(body.ok, true);
});
