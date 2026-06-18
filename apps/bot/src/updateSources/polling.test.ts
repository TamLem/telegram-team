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
