import test from "node:test";
import assert from "node:assert/strict";
import { miniAppRootUrl } from "./webApp.js";

test("persistent Mini App menu uses a stable context-free URL", () => {
  assert.equal(
    miniAppRootUrl("https://taskpilot.example.com/something"),
    "https://taskpilot.example.com/app"
  );
});
