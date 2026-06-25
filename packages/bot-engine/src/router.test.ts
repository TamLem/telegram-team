import test from "node:test";
import assert from "node:assert/strict";
import { CommandRouter } from "./router.js";

function ctx(text: string) {
  return { text } as any;
}

test("CommandRouter dispatches private chat commands", async () => {
  const router = new CommandRouter();
  let called = false;

  router.add("/start", async () => {
    called = true;
  });

  const handled = await router.handle(ctx("/start"));

  assert.equal(handled, true);
  assert.equal(called, true);
});

test("CommandRouter dispatches commands addressed to this bot", async () => {
  const router = new CommandRouter();
  router.setBotUsername("taskpi_bot");
  let called = false;

  router.add("/start", async () => {
    called = true;
  });

  const handled = await router.handle(ctx("/start@TaskPi_Bot"));

  assert.equal(handled, true);
  assert.equal(called, true);
});

test("CommandRouter ignores commands addressed to another bot", async () => {
  const router = new CommandRouter();
  router.setBotUsername("taskpi_bot");
  let called = false;

  router.add("/start", async () => {
    called = true;
  });

  const handled = await router.handle(ctx("/start@OtherBot"));

  assert.equal(handled, false);
  assert.equal(called, false);
});

test("CommandRouter ignores addressed commands when bot username is unknown", async () => {
  const router = new CommandRouter();
  let called = false;

  router.add("/start", async () => {
    called = true;
  });

  const handled = await router.handle(ctx("/start@TaskPi_Bot"));

  assert.equal(handled, false);
  assert.equal(called, false);
});
