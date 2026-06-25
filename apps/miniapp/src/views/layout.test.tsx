import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import React from "hono/jsx";
import { jsxRenderer } from "hono/jsx-renderer";
// The root test runner does not use the Mini App's JSX tsconfig. Import the
// build output so production JSX compilation is what this regression verifies.
import { Layout } from "../../dist/views/layout.js";
import { JoinRequestsPage } from "../../dist/views/pages/JoinRequestsPage.js";
import { TeamPage } from "../../dist/views/pages/TeamPage.js";

function createRenderApp() {
  const app = new Hono();
  const renderer = jsxRenderer(({ children }) => <Layout>{children}</Layout>);
  app.use("/app", renderer);
  app.use("/app/*", renderer);
  app.get("/app", (c) => c.render(<h1>Standalone Mini App</h1>));
  app.get("/app/team", (c) =>
    c.render(
      <TeamPage
        team={{ id: "team-1", name: "Operations", inviteCode: "ABC123" }}
        userRole="owner"
        memberCount={2}
        pendingRequestCount={1}
        ctx="context-token"
      />
    )
  );
  app.post("/app/team/join-requests", (c) =>
    c.render(
      <JoinRequestsPage
        teamId="team-1"
        requests={[]}
        ctx="context-token"
        success="Request rejected"
      />
    )
  );
  return app;
}

function count(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

test("Mini App GET pages render one complete stylesheet", async () => {
  const response = await createRenderApp().request("/app/team");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(count(body, /<style>/g), 1);
  assert.equal(count(body, /<\/style>/g), 1);
  assert.doesNotMatch(body, /color:\s*\{pendingRequestCount/);
  assert.match(body, /color:var\(--tg-theme-destructive-text-color/);
});

test("Mini App POST result pages retain layout CSS and Telegram runtime", async () => {
  const response = await createRenderApp().request(
    "/app/team/join-requests",
    { method: "POST" }
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(count(body, /<style>/g), 1);
  assert.equal(count(body, /<\/style>/g), 1);
  assert.match(body, /class="container"/);
  assert.match(body, /telegram-web-app\.js/);
  assert.match(body, /Request rejected/);
  assert.doesNotMatch(body, /<\/style>\s*<\/style>/);
});

test("standalone /app entry renders through the shared layout", async () => {
  const response = await createRenderApp().request("/app");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Standalone Mini App/);
  assert.match(body, /class="container"/);
  assert.equal(count(body, /<style>/g), 1);
});
