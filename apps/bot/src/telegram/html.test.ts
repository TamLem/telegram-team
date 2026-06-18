import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "./html.js";

test("escapeHtml escapes Telegram HTML control characters", () => {
  assert.equal(
    escapeHtml('A&B <Team> "Name"'),
    "A&amp;B &lt;Team&gt; &quot;Name&quot;"
  );
});
