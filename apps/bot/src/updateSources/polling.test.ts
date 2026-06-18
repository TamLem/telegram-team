import test from "node:test";
import assert from "node:assert/strict";
import { PollingSource } from "./polling.js";

test("PollingSource retries failed updates before skipping them", async () => {
  const offsets: number[] = [];
  let getUpdatesCalls = 0;
  let handleUpdateCalls = 0;

  const update = {
    update_id: 1,
    message: {
      message_id: 10,
      date: 1,
      chat: { id: 100, type: "private" },
      text: "/start",
    },
  };

  let source: PollingSource;

  const api = {
    deleteWebhook: async () => true,
    getUpdates: async (params: { offset?: number }) => {
      offsets.push(params.offset ?? 0);
      getUpdatesCalls += 1;
      if (getUpdatesCalls <= 2) return [update];
      source.stop();
      return [];
    },
  };

  const bot = {
    handleUpdate: async () => {
      handleUpdateCalls += 1;
      return { ok: false, error: new Error("boom") };
    },
  };

  source = new PollingSource(api as any, bot as any);

  await source.start({
    maxUpdateFailures: 2,
    retryDelayMs: 0,
    pollTimeout: 0,
  });

  assert.equal(handleUpdateCalls, 2);
  assert.deepEqual(offsets, [0, 0, 2]);
});

test("PollingSource fails startup when webhook deletion fails", async () => {
  const failure = new Error("webhook still configured");
  const api = {
    deleteWebhook: async () => {
      throw failure;
    },
    getUpdates: async () => {
      throw new Error("getUpdates should not be called");
    },
  };
  const bot = {
    handleUpdate: async () => ({ ok: true }),
  };

  const source = new PollingSource(api as any, bot as any);

  await assert.rejects(() => source.start({ retryDelayMs: 0 }), failure);
});

test("PollingSource passes request timeout to getUpdates", async () => {
  let requestTimeoutMs: number | undefined;
  let source: PollingSource;
  const api = {
    deleteWebhook: async () => true,
    getUpdates: async (params: { requestTimeoutMs?: number }) => {
      requestTimeoutMs = params.requestTimeoutMs;
      source.stop();
      return [];
    },
  };
  const bot = {
    handleUpdate: async () => ({ ok: true }),
  };

  source = new PollingSource(api as any, bot as any);

  await source.start({
    pollTimeout: 1,
    requestTimeoutMs: 1_500,
  });

  assert.equal(requestTimeoutMs, 1_500);
});

test("PollingSource counts handler timeouts as update failures", async () => {
  const offsets: number[] = [];
  let source: PollingSource;
  const update = {
    update_id: 7,
    message: {
      message_id: 10,
      date: 1,
      chat: { id: 100, type: "private" },
      text: "/start",
    },
  };
  const api = {
    deleteWebhook: async () => true,
    getUpdates: async (params: { offset?: number }) => {
      offsets.push(params.offset ?? 0);
      if (offsets.length === 1) return [update];
      source.stop();
      return [];
    },
  };
  const bot = {
    handleUpdate: async () => new Promise(() => {}),
  };

  source = new PollingSource(api as any, bot as any);

  await source.start({
    maxUpdateFailures: 1,
    handlerTimeoutMs: 1,
    pollTimeout: 1,
    retryDelayMs: 0,
  });

  assert.deepEqual(offsets, [0, 8]);
});
