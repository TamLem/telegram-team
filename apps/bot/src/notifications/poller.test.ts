import test from "node:test";
import assert from "node:assert/strict";
import { TelegramApiError } from "@telegram-team/bot-engine";

process.env.MINIAPP_BASE_URL = "https://taskpi.example.com";
process.env.API_BASE_URL = "http://api:3001";
process.env.MINIAPP_CONTEXT_SECRET = "test-context-secret";

const {
  buildMembershipActionButtons,
  formatMessage,
  formatCommentSnippet,
  isMembershipReadyEvent,
  isPermanentDeliveryFailure,
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

test("task_commented escapes HTML and truncates long comment bodies", () => {
  const long = "x".repeat(500);
  const message = formatMessage("task_commented", {
    taskTitle: "Fix <parser> & ship",
    teamName: "Ops & Support",
    actorName: "Bob <dev>",
    commentBody: `Hello <script> & co — ${long}`,
    taskId: "task-1",
    teamId: "team-1",
  });

  assert.match(message, /New comment on task/);
  assert.match(message, /Fix &lt;parser&gt; &amp; ship/);
  assert.match(message, /Ops &amp; Support/);
  assert.match(message, /Bob &lt;dev&gt;/);
  assert.match(message, /Hello &lt;script&gt; &amp; co/);
  assert.doesNotMatch(message, /<script>/);
  // Truncated preview ends with ellipsis after escape of clipped plain text
  assert.match(message, /…/);
  assert.ok(message.length < 900);
});

test("formatCommentSnippet truncates then escapes", () => {
  assert.equal(formatCommentSnippet("a < b"), "a &lt; b");
  assert.equal(formatCommentSnippet("x".repeat(10), 5), "xxxxx…");
  assert.equal(formatCommentSnippet("   "), "");
});

test("permanent delivery failures include blocked users and missing chats", () => {
  assert.equal(
    isPermanentDeliveryFailure(
      new TelegramApiError("blocked", {
        method: "sendMessage",
        errorCode: 403,
        description: "Forbidden: bot was blocked by the user",
      })
    ),
    true
  );
  assert.equal(
    isPermanentDeliveryFailure(
      new TelegramApiError("missing", {
        method: "sendMessage",
        errorCode: 400,
        description: "Bad Request: chat not found",
      })
    ),
    true
  );
  assert.equal(
    isPermanentDeliveryFailure(
      new TelegramApiError("rate", {
        method: "sendMessage",
        errorCode: 429,
        description: "Too Many Requests",
      })
    ),
    false
  );
  assert.equal(isPermanentDeliveryFailure(new Error("network blip")), false);
});
