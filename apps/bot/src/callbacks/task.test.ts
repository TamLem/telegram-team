import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskCallbackData } from "./task.js";

test("parseTaskCallbackData parses status callbacks", () => {
  assert.deepEqual(parseTaskCallbackData("task:status:doing:task_123"), {
    action: "status",
    subAction: "doing",
    taskId: "task_123",
  });
});

test("parseTaskCallbackData parses simple task callbacks", () => {
  assert.deepEqual(parseTaskCallbackData("task:open:task_123"), {
    action: "open",
    taskId: "task_123",
  });
});

test("parseTaskCallbackData rejects malformed callbacks", () => {
  assert.equal(parseTaskCallbackData("task:"), null);
  assert.equal(parseTaskCallbackData("task:status:doing"), null);
  assert.equal(parseTaskCallbackData("other:status:doing:task_123"), null);
});
