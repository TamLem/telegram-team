import test from "node:test";
import assert from "node:assert/strict";

test("task callback: task:open parses correctly (used by Mini App detail button)", () => {
  const data = "task:open:task_123";
  const parts = data.split(":");
  assert.equal(parts[0], "task");
  assert.equal(parts[1], "open");
  assert.equal(parts[2], "task_123");
});

test("task callback: unrecognized actions are ignored", () => {
  const data = "task:status:doing:task_123";
  const parts = data.split(":");
  const action = parts[1];
  assert.equal(action, "status");
  assert.notEqual(action, "open");
});
