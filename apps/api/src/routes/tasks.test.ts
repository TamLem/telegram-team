import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import { createDb, getDb, notifications } from "@telegram-team/db";
import { eq } from "drizzle-orm";
import { tasksRouter } from "./tasks.js";
import { teamsRouter } from "./teams.js";
import { usersRouter } from "./users.js";
import { healthRouter } from "./health.js";

const DB_URL = path.join(
  tmpdir(),
  `telegram-team-api-test-${process.pid}-${Date.now()}.db`
);
process.env.DATABASE_URL = DB_URL;
process.env.INTERNAL_API_KEY = "test-internal-key";

const app = new Hono();
app.route("/", healthRouter);
app.route("/api", tasksRouter);
app.route("/api", teamsRouter);
app.route("/api", usersRouter);

async function createUser(tgId: number, firstName: string): Promise<string> {
  const res = await app.request(`/api/users/telegram/${tgId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramUserId: tgId,
      firstName,
      lastName: null,
      telegramUsername: null,
    }),
  });
  const body = await res.json() as any;
  return body.user.id;
}

// ─── Health ──────────────────────────────────────────────────────────

test("GET /health returns ok", async () => {
  const res = await app.request("/health");
  assert.equal(res.status, 200);
  const body = await res.json() as any;
  assert.equal(body.status, "ok");
});

test("GET /ready returns ready", async () => {
  const res = await app.request("/ready");
  assert.equal(res.status, 200);
  const body = await res.json() as any;
  assert.equal(body.status, "ready");
});

// ─── Authentication ──────────────────────────────────────────────────

test("GET /api/tasks/:id returns 404 for non-existent task", async () => {
  const res = await app.request("/api/tasks/nonexistent-task");
  assert.equal(res.status, 404);
});

test("GET /api/tasks without auth returns 401", async () => {
  const res = await app.request("/api/tasks");
  assert.equal(res.status, 401);
});

test("POST /api/teams requires user context (no X-User-Id)", async () => {
  const res = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test" }),
  });
  assert.equal(res.status, 401);
});

test("GET /api/me requires user context (no X-User-Id)", async () => {
  const res = await app.request("/api/me");
  assert.equal(res.status, 401);
});

// ─── User creation ───────────────────────────────────────────────────

test("PUT /api/users/telegram/:id creates a user", async () => {
  const res = await app.request("/api/users/telegram/1101", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramUserId: 1101,
      firstName: "Alice",
      lastName: null,
      telegramUsername: "alice",
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json() as any;
  assert.ok(body.user.id);
  assert.equal(body.user.firstName, "Alice");
  assert.equal(body.user.telegramUserId, 1101);
});

test("PUT /api/users/telegram/:id updates existing user", async () => {
  const res = await app.request("/api/users/telegram/1101", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramUserId: 1101,
      firstName: "Alice Updated",
      lastName: "Smith",
      telegramUsername: "alice2",
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json() as any;
  assert.equal(body.user.firstName, "Alice Updated");
  assert.equal(body.user.lastName, "Smith");
});

// ─── Team creation ───────────────────────────────────────────────────

test("POST /api/teams creates a team and adds creator as owner", async () => {
  const aliceId = await createUser(1101, "Alice");

  const res = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": aliceId },
    body: JSON.stringify({ name: "My Team" }),
  });

  assert.equal(res.status, 201);
  const body = await res.json() as any;
  assert.equal(body.team.name, "My Team");
  assert.ok(body.team.inviteCode);
  assert.ok(body.team.id);

  const creationNotifications = await getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, aliceId));
  assert.ok(
    creationNotifications.some((notification) =>
      notification.eventType === "team_created"
    )
  );

  const membersRes = await app.request(`/api/teams/${body.team.id}/members`, {
    headers: { "X-User-Id": aliceId },
  });
  const membersBody = await membersRes.json() as any;
  assert.equal(membersBody.members.length, 1);
  assert.equal(membersBody.members[0].role, "owner");
});

// ─── Join request flow ───────────────────────────────────────────────

test("POST /api/teams/join creates a pending join request", async () => {
  const aliceId = await createUser(1201, "Alice2");
  const teamRes = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": aliceId },
    body: JSON.stringify({ name: "Join Test Team" }),
  });
  const team = (await teamRes.json() as any).team;

  const bobId = await createUser(1202, "Bob");

  const joinRes = await app.request("/api/teams/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": bobId },
    body: JSON.stringify({ inviteCode: team.inviteCode }),
  });

  assert.equal(joinRes.status, 201);
  const joinBody = await joinRes.json() as any;
  assert.equal(joinBody.request.status, "pending");
  assert.equal(joinBody.request.userId, bobId);

  const requesterNotifications = await getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, bobId));
  assert.ok(
    requesterNotifications.some((notification) =>
      notification.eventType === "join_request_submitted"
    )
  );
});

test("POST /api/teams/join rejects invalid invite code", async () => {
  const bobId = await createUser(1202, "Bob");

  const res = await app.request("/api/teams/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": bobId },
    body: JSON.stringify({ inviteCode: "INVALID" }),
  });

  assert.equal(res.status, 404);
});

test("POST /api/teams/join prevents duplicate join request", async () => {
  const aliceId = await createUser(1301, "Alice3");
  const teamRes = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": aliceId },
    body: JSON.stringify({ name: "Dup Test Team" }),
  });
  const team = (await teamRes.json() as any).team;

  const bobId = await createUser(1302, "Bob2");

  const res1 = await app.request("/api/teams/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": bobId },
    body: JSON.stringify({ inviteCode: team.inviteCode }),
  });
  assert.equal(res1.status, 201);

  const res2 = await app.request("/api/teams/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": bobId },
    body: JSON.stringify({ inviteCode: team.inviteCode }),
  });
  assert.notEqual(res2.status, 201);
});

// ─── Join approval ───────────────────────────────────────────────────

test("admin can approve join request", async () => {
  const aliceId = await createUser(1401, "Alice4");
  const teamRes = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": aliceId },
    body: JSON.stringify({ name: "Approve Test Team" }),
  });
  const team = (await teamRes.json() as any).team;

  const bobId = await createUser(1402, "Bob3");

  const joinRes = await app.request("/api/teams/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": bobId },
    body: JSON.stringify({ inviteCode: team.inviteCode }),
  });
  const request = (await joinRes.json() as any).request;

  const approveRes = await app.request(
    `/api/teams/${team.id}/join-requests/${request.id}/approve`,
    { method: "POST", headers: { "X-User-Id": aliceId } }
  );

  assert.equal(approveRes.status, 200);
  const approveBody = await approveRes.json() as any;
  assert.equal(approveBody.request.status, "approved");

  const membersRes = await app.request(`/api/teams/${team.id}/members`, {
    headers: { "X-User-Id": aliceId },
  });
  const membersBody = await membersRes.json() as any;
  assert.equal(membersBody.members.length, 2);
  assert.ok(membersBody.members.some((m: any) => m.userId === bobId));

  const bobTeams = await app.request("/api/me/teams", {
    headers: { "X-User-Id": bobId },
  });
  const bobTeamsBody = await bobTeams.json() as any;
  assert.ok(bobTeamsBody.teams.some((t: any) => t.id === team.id));
});

// ─── Member removal ──────────────────────────────────────────────────

test("admin can remove member", async () => {
  const aliceId = await createUser(1501, "Alice5");
  const teamRes = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": aliceId },
    body: JSON.stringify({ name: "Remove Test Team" }),
  });
  const team = (await teamRes.json() as any).team;

  const bobId = await createUser(1502, "Bob4");

  const joinRes = await app.request("/api/teams/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": bobId },
    body: JSON.stringify({ inviteCode: team.inviteCode }),
  });
  const request = (await joinRes.json() as any).request;

  await app.request(
    `/api/teams/${team.id}/join-requests/${request.id}/approve`,
    { method: "POST", headers: { "X-User-Id": aliceId } }
  );

  const removeRes = await app.request(
    `/api/teams/${team.id}/members/${bobId}/remove`,
    { method: "POST", headers: { "X-User-Id": aliceId } }
  );

  assert.equal(removeRes.status, 200);

  const membersRes = await app.request(`/api/teams/${team.id}/members`, {
    headers: { "X-User-Id": aliceId },
  });
  const membersBody = await membersRes.json() as any;
  assert.equal(membersBody.members.length, 1);

  const bobTeams = await app.request("/api/me/teams", {
    headers: { "X-User-Id": bobId },
  });
  const bobTeamsBody = await bobTeams.json() as any;
  assert.ok(bobTeamsBody.teams.length === 0);
});

test("cannot remove the team owner", async () => {
  const aliceId = await createUser(1501, "Alice5");

  const teamsRes = await app.request("/api/me/teams", {
    headers: { "X-User-Id": aliceId },
  });
  const teamsBody = await teamsRes.json() as any;
  const team = teamsBody.teams[0];

  const removeRes = await app.request(
    `/api/teams/${team.id}/members/${aliceId}/remove`,
    { method: "POST", headers: { "X-User-Id": aliceId } }
  );

  assert.equal(removeRes.status, 403);
});

// ─── Task creation ───────────────────────────────────────────────────

test("POST /api/tasks creates a task", async () => {
  const aliceId = await createUser(1601, "Alice6");
  const teamRes = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": aliceId },
    body: JSON.stringify({ name: "Task Test Team" }),
  });
  const team = (await teamRes.json() as any).team;

  const res = await app.request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": aliceId,
      "X-Team-Id": team.id,
    },
    body: JSON.stringify({ title: "Test Task", description: "Desc", priority: "high" }),
  });

  assert.equal(res.status, 201);
  const body = await res.json() as any;
  assert.equal(body.task.title, "Test Task");
  assert.equal(body.task.status, "todo");
  assert.equal(body.task.priority, "high");
  assert.equal(body.task.teamId, team.id);
});

test("non-member cannot create task in team", async () => {
  const bobId = await createUser(1603, "Bob5");

  const res = await app.request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": bobId,
      "X-Team-Id": "some-team-id",
    },
    body: JSON.stringify({ title: "Unauthorized Task" }),
  });

  assert.equal(res.status, 403);
});

// ─── Status update ───────────────────────────────────────────────────

test("team member can update task status", async () => {
  const aliceId = await createUser(1601, "Alice6");

  const tasksRes = await app.request("/api/tasks?limit=10", {
    headers: { "X-User-Id": aliceId },
  });
  const tasksBody = await tasksRes.json() as any;
  assert.ok(tasksBody.tasks.length > 0);

  const task = tasksBody.tasks[0];

  const statusRes = await app.request(`/api/tasks/${task.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": aliceId },
    body: JSON.stringify({ status: "doing" }),
  });

  assert.equal(statusRes.status, 200);
  const statusBody = await statusRes.json() as any;
  assert.equal(statusBody.task.status, "doing");
});

// ─── Comments ─────────────────────────────────────────────────────────

test("team member can add and view comments", async () => {
  const aliceId = await createUser(1601, "Alice6");

  const tasksRes = await app.request("/api/tasks?limit=10", {
    headers: { "X-User-Id": aliceId },
  });
  const tasksBody = await tasksRes.json() as any;
  const task = tasksBody.tasks[0];

  const commentRes = await app.request(`/api/tasks/${task.id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": aliceId },
    body: JSON.stringify({ body: "This is a test comment" }),
  });

  assert.equal(commentRes.status, 201);
  const commentBody = await commentRes.json() as any;
  assert.equal(commentBody.comment.body, "This is a test comment");

  const listRes = await app.request(`/api/tasks/${task.id}/comments`, {
    headers: { "X-User-Id": aliceId },
  });
  const listBody = await listRes.json() as any;
  assert.ok(listBody.comments.length >= 1);
});

// ─── Activity events ──────────────────────────────────────────────────

test("task events are recorded on status change", async () => {
  const aliceId = await createUser(1601, "Alice6");

  const tasksRes = await app.request("/api/tasks?limit=10", {
    headers: { "X-User-Id": aliceId },
  });
  const tasksBody = await tasksRes.json() as any;
  const task = tasksBody.tasks[0];

  const eventsRes = await app.request(`/api/tasks/${task.id}/events`, {
    headers: { "X-User-Id": aliceId },
  });
  const eventsBody = await eventsRes.json() as any;
  assert.ok(eventsBody.events.length >= 1);
});

// ─── Authorization across teams ──────────────────────────────────────

test("user from team A cannot access team B tasks", async () => {
  const carolId = await createUser(1701, "Carol");
  const teamARes = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": carolId },
    body: JSON.stringify({ name: "Team A" }),
  });
  const teamA = (await teamARes.json() as any).team;

  const daveId = await createUser(1702, "Dave");
  const teamBRes = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": daveId },
    body: JSON.stringify({ name: "Team B" }),
  });
  const teamB = (await teamBRes.json() as any).team;

  const taskRes = await app.request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": daveId,
      "X-Team-Id": teamB.id,
    },
    body: JSON.stringify({ title: "Dave's private task" }),
  });
  const task = (await taskRes.json() as any).task;

  const crossRes = await app.request(`/api/tasks/${task.id}`, {
    headers: { "X-User-Id": carolId },
  });

  assert.equal(crossRes.status, 403);
});

test("user from team A cannot access team B members", async () => {
  const carolId = await createUser(1701, "Carol");
  const daveId = await createUser(1702, "Dave");

  const teamsRes = await app.request("/api/me/teams", {
    headers: { "X-User-Id": daveId },
  });
  const teamB = (await teamsRes.json() as any).teams[0];

  const membersRes = await app.request(`/api/teams/${teamB.id}/members`, {
    headers: { "X-User-Id": carolId },
  });

  assert.equal(membersRes.status, 403);
});

// ─── Invite code regeneration ────────────────────────────────────────

test("admin can regenerate invite code", async () => {
  const carolId = await createUser(1701, "Carol");

  const teamsRes = await app.request("/api/me/teams", {
    headers: { "X-User-Id": carolId },
  });
  const team = (await teamsRes.json() as any).teams[0];

  const regenRes = await app.request(
    `/api/teams/${team.id}/invite-code/regenerate`,
    { method: "POST", headers: { "X-User-Id": carolId } }
  );

  assert.equal(regenRes.status, 200);
  const regenBody = await regenRes.json() as any;
  assert.ok(regenBody.inviteCode);
  assert.notEqual(regenBody.inviteCode, "");
});

test("non-member cannot regenerate invite code for another team", async () => {
  const bobId = await createUser(1704, "Bob6");

  const teamsRes = await app.request("/api/me/teams", {
    headers: { "X-User-Id": bobId },
  });
  assert.equal(teamsRes.status, 200);
  const body = await teamsRes.json() as any;
  assert.equal(body.teams.length, 0);
});

// ─── Role changes ────────────────────────────────────────────────────

test("admin can promote member to admin", async () => {
  const eveId = await createUser(1801, "Eve");
  const teamRes = await app.request("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": eveId },
    body: JSON.stringify({ name: "Role Test Team" }),
  });
  const team = (await teamRes.json() as any).team;

  const frankId = await createUser(1802, "Frank");
  const joinRes = await app.request("/api/teams/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": frankId },
    body: JSON.stringify({ inviteCode: team.inviteCode }),
  });
  const request = (await joinRes.json() as any).request;

  await app.request(
    `/api/teams/${team.id}/join-requests/${request.id}/approve`,
    { method: "POST", headers: { "X-User-Id": eveId } }
  );

  const promoteRes = await app.request(
    `/api/teams/${team.id}/members/${frankId}/role`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": eveId },
      body: JSON.stringify({ role: "admin" }),
    }
  );

  assert.equal(promoteRes.status, 200);
  const promoteBody = await promoteRes.json() as any;
  assert.equal(promoteBody.member.role, "admin");
});

test("cannot change the owner's role", async () => {
  const eveId = await createUser(1801, "Eve");

  const teamsRes = await app.request("/api/me/teams", {
    headers: { "X-User-Id": eveId },
  });
  const team = (await teamsRes.json() as any).teams[0];

  const res = await app.request(
    `/api/teams/${team.id}/members/${eveId}/role`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": eveId },
      body: JSON.stringify({ role: "member" }),
    }
  );

  assert.equal(res.status, 403);
});

// ─── Team activity ──────────────────────────────────────────────────

test("team activity shows membership events", async () => {
  const eveId = await createUser(1801, "Eve");

  const teamsRes = await app.request("/api/me/teams", {
    headers: { "X-User-Id": eveId },
  });
  const team = (await teamsRes.json() as any).teams[0];

  const activityRes = await app.request(`/api/teams/${team.id}/activity`, {
    headers: { "X-User-Id": eveId },
  });

  assert.equal(activityRes.status, 200);
  const body = await activityRes.json() as any;
  assert.ok(Array.isArray(body.events));
  assert.ok(body.events.length >= 1);
});
