import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import {
  createDb,
  tasks,
  teamJoinRequests,
  teamMembers,
  teams,
  users,
} from "@telegram-team/db";
import { tasksRouter } from "./tasks.js";
import { teamsRouter } from "./teams.js";

process.env.DATABASE_URL = path.join(
  tmpdir(),
  `telegram-team-api-test-${process.pid}.db`
);

const app = new Hono();
app.route("/api", tasksRouter);
app.route("/api", teamsRouter);

async function seedTask() {
  const db = createDb(process.env.DATABASE_URL);
  const now = new Date().toISOString();

  await db.insert(users).values({
    id: "user_1",
    telegramUserId: 1001,
    firstName: "Ada",
    lastName: null,
    telegramUsername: "ada",
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  });

  await db.insert(users).values({
    id: "user_2",
    telegramUserId: 1002,
    firstName: "Grace",
    lastName: null,
    telegramUsername: "grace",
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  });

  await db.insert(teams).values({
    id: "team_1",
    name: "Core",
    slug: "core",
    inviteCode: "CORE1",
    createdByUserId: "user_1",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(teamMembers).values({
    id: "member_1",
    teamId: "team_1",
    userId: "user_1",
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(teamJoinRequests).values({
    id: "join_1",
    teamId: "team_1",
    userId: "user_2",
    status: "pending",
    requestedAt: now,
    reviewedAt: null,
    reviewedByUserId: null,
  });

  await db.insert(tasks).values({
    id: "task_1",
    teamId: "team_1",
    title: "Private task",
    description: null,
    status: "todo",
    priority: "normal",
    createdById: "user_1",
    assignedToUserId: null,
    dueAt: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    cancelledAt: null,
  });
}

test("task detail requires user context", async () => {
  await seedTask();

  const res = await app.request("/api/tasks/task_1");

  assert.equal(res.status, 401);
});

test("task comments require user context", async () => {
  const res = await app.request("/api/tasks/task_1/comments");

  assert.equal(res.status, 401);
});

test("task events require user context", async () => {
  const res = await app.request("/api/tasks/task_1/events");

  assert.equal(res.status, 401);
});

test("pending join requester can fetch admin contacts for that request", async () => {
  const res = await app.request(
    "/api/teams/team_1/admin-contacts?request_id=join_1",
    { headers: { "X-User-Id": "user_2" } }
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    admins: [
      {
        userId: "user_1",
        telegramUserId: 1001,
        telegramUsername: "ada",
        firstName: "Ada",
      },
    ],
  });
});
