import test from "node:test";
import assert from "node:assert/strict";
import { formatApiErrorBody, ApiHttpError } from "./apiClient.js";

test("formatApiErrorBody prefers string error field", () => {
  assert.equal(
    formatApiErrorBody({ error: "Assignee must be an active team member" }, 400),
    "Assignee must be an active team member"
  );
});

test("formatApiErrorBody flattens Zod-style issues", () => {
  assert.equal(
    formatApiErrorBody(
      {
        error: {
          issues: [
            { message: "Required" },
            { message: "intervalDays is required for custom intervals" },
          ],
        },
      },
      400
    ),
    "Required; intervalDays is required for custom intervals"
  );
});

test("formatApiErrorBody falls back to status", () => {
  assert.equal(formatApiErrorBody({}, 500), "API error: 500");
});

test("ApiHttpError carries status", () => {
  const err = new ApiHttpError("nope", 403);
  assert.equal(err.status, 403);
  assert.equal(err.message, "nope");
});
