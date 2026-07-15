import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import React from "hono/jsx";
import { jsxRenderer } from "hono/jsx-renderer";
import { Layout } from "../../../dist/views/layout.js";
import { MiniAppNav } from "../../../dist/views/components/MiniAppNav.js";
import { MyTasksPage } from "../../../dist/views/pages/MyTasksPage.js";

function createApp() {
  const app = new Hono();
  const renderer = jsxRenderer(({ children }) => <Layout>{children}</Layout>);
  app.use("/app", renderer);
  app.use("/app/*", renderer);
  app.get("/app/nav", (c) =>
    c.render(
      <MiniAppNav
        teamId="team-1"
        teamName="Operations"
        teams={[
          { id: "team-1", name: "Operations" },
          { id: "team-2", name: "Growth" },
        ]}
        current="board"
      />
    )
  );
  app.get("/app/my-tasks-sample", (c) =>
    c.render(
      <MyTasksPage
        tasks={[]}
        teams={[{ id: "team-1", name: "Operations", role: "owner" }]}
        activeTeamId="team-1"
      />
    )
  );
  return app;
}

test("MiniAppNav renders top context bar and bottom tab bar", async () => {
  const response = await createApp().request("/app/nav");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /class="miniapp-topbar"/);
  assert.match(body, /class="miniapp-tabbar"/);
  assert.match(body, /Operations/);
  assert.match(body, /href="\/app\/teams"/);
  assert.match(body, /href="\/app\/tasks\/new"/);
  assert.match(body, /href="\/app\/my-tasks"/);
  assert.match(body, /href="\/app\/board\/team-1"/);
  assert.match(body, /href="\/app\/chores"/);
  assert.match(body, /href="\/app\/team"/);
  assert.match(body, /miniapp-tab--active/);
  assert.match(body, /aria-label="Main"/);
  // Old single-row nav classes should be gone
  assert.doesNotMatch(body, /miniapp-nav-links/);
});

test("My Tasks page omits redundant h1 in favor of summary", async () => {
  const response = await createApp().request("/app/my-tasks-sample");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /page-summary/);
  assert.match(body, /Open work across all your teams/);
  assert.doesNotMatch(body, /<h1>My Tasks<\/h1>/);
});
