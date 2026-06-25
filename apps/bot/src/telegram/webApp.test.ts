import test from "node:test";
import assert from "node:assert/strict";
import { miniAppRootUrl } from "./webApp.js";

test("persistent Mini App menu uses a stable context-free URL", () => {
  assert.equal(
    miniAppRootUrl("https://taskpi.example.com/something"),
    "https://taskpi.example.com/app"
  );
});
