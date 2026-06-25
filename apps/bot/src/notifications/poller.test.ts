import test from "node:test";
import assert from "node:assert/strict";

process.env.MINIAPP_BASE_URL = "https://taskpi.example.com";
process.env.API_BASE_URL = "http://api:3001";
process.env.MINIAPP_CONTEXT_SECRET = "test-context-secret";

const {
  buildMembershipActionButtons,
  formatMessage,
  isMembershipReadyEvent,
} = await import("./poller.js");

test("approved joins are treated as membership-ready events", () => {
  assert.equal(isMembershipReadyEvent("join_request_approved"), true);
  assert.equal(isMembershipReadyEvent("team_created"), true);
  assert.equal(isMembershipReadyEvent("join_request_submitted"), false);
});

test("membership confirmations provide task, board, and team actions", () => {
  const buttons = buildMembershipActionButtons(1001, "team-1").flat();

  assert.deepEqual(
    buttons.map((button) => button.text),
    ["Open My Tasks", "Open Board", "Team & Members"]
  );
  for (const button of buttons) {
    const url = new URL(button.web_app.url);
    assert.equal(url.origin, "https://taskpi.example.com");
    assert.ok(url.searchParams.get("ctx"));
  }
});

test("approved join confirmation explains the newly available menus", () => {
  const message = formatMessage("join_request_approved", {
    taskTitle: "Operations & Support",
    memberName: "Admin <One>",
  });

  assert.match(message, /now a member/);
  assert.match(message, /keyboard below/);
  assert.match(message, /Operations &amp; Support/);
  assert.match(message, /Admin &lt;One&gt;/);
});
