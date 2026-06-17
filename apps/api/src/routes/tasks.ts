import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createTaskSchema, updateTaskSchema, paginationSchema } from "@telegram-team/shared";
import { getDb } from "@telegram-team/db";
import { tasks, taskComments, taskEvents, users } from "@telegram-team/db";
import { eq, desc, count, and, inArray } from "drizzle-orm";
import { generateId } from "@telegram-team/shared";
import { getTeamMember, isTeamAdmin, getUserActiveMemberships } from "../services/membership.service.js";
import { canCreateTask, canUpdateTask } from "../services/authorization.service.js";

export const tasksRouter = new Hono();

function getUserId(c: any): string {
  return c.get("apiUser")?.id ?? c.req.header("X-User-Id") ?? "";
}

async function requireTeamAccess(c: any, teamId: string) {
  const userId = getUserId(c);
  if (!userId) {
    return { error: "Unauthorized", status: 401 };
  }

  const member = await getTeamMember(teamId, userId);
  if (!member) {
    return { error: "You are not a member of this team", status: 403 };
  }

  return { member, userId };
}

tasksRouter.get("/tasks", zValidator("query", paginationSchema), async (c) => {
  const { limit, offset } = c.req.valid("query");
  const teamId = c.req.query("teamId");
  const assigneeId = c.req.query("assigneeId");
  const status = c.req.query("status");

  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const memberships = await getUserActiveMemberships(userId);
  const userTeamIds = memberships.map((m) => m.teamId);

  const db = getDb();
  const conditions = [];

  if (teamId) {
    if (!userTeamIds.includes(teamId)) {
      return c.json({ error: "You are not a member of this team" }, 403);
    }
    conditions.push(eq(tasks.teamId, teamId));
  } else {
    if (userTeamIds.length === 0) {
      conditions.push(eq(tasks.teamId, "__none__"));
    } else {
      conditions.push(inArray(tasks.teamId, userTeamIds));
    }
  }

  if (assigneeId) {
    conditions.push(eq(tasks.assigneeId, assigneeId));
  }
  if (status) {
    conditions.push(eq(tasks.status, status));
  }

  const where = and(...conditions);

  const [total] = await db
    .select({ count: count() })
    .from(tasks)
    .where(where);

  const result = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    tasks: result,
    total: total.count,
    limit,
    offset,
  });
});

tasksRouter.post("/tasks", zValidator("json", createTaskSchema), async (c) => {
  const body = c.req.valid("json");
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const teamId = body.teamId;
  if (!teamId) {
    return c.json({ error: "teamId is required" }, 400);
  }

  const member = await getTeamMember(teamId, userId);
  if (!member) {
    return c.json({ error: "You are not a member of this team" }, 403);
  }

  if (!canCreateTask(member)) {
    return c.json({ error: "You do not have permission to create tasks" }, 403);
  }

  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const [task] = await db
    .insert(tasks)
    .values({
      id,
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? "todo",
      priority: body.priority ?? "medium",
      assigneeId: body.assigneeId ?? null,
      teamId,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(taskEvents).values({
    id: generateId(),
    taskId: id,
    userId,
    eventType: "created",
    createdAt: now,
  });

  return c.json({ task }, 201);
});

tasksRouter.get("/tasks/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  if (task.teamId) {
    const userId = getUserId(c);
    if (userId) {
      const member = await getTeamMember(task.teamId, userId);
      if (!member) {
        return c.json({ error: "Access denied" }, 403);
      }
    }
  }

  return c.json({ task });
});

tasksRouter.patch("/tasks/:id", zValidator("json", updateTaskSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid("json");
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDb();

  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  if (existing.teamId) {
    const member = await getTeamMember(existing.teamId, userId);
    if (!member) {
      return c.json({ error: "Access denied" }, 403);
    }
    if (!canUpdateTask(member, existing.createdById, existing.assigneeId)) {
      return c.json({ error: "You do not have permission to update this task" }, 403);
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;

  const [task] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();

  if (body.status !== undefined && body.status !== existing.status) {
    await db.insert(taskEvents).values({
      id: generateId(),
      taskId: id,
      userId,
      eventType: "status_changed",
      data: JSON.stringify({ from: existing.status, to: body.status }),
      createdAt: new Date().toISOString(),
    });
  }

  return c.json({ task });
});

tasksRouter.get("/tasks/:id/comments", async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  const result = await db
    .select()
    .from(taskComments)
    .innerJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, id))
    .orderBy(taskComments.createdAt);

  const comments = result.map(({ task_comments, users }) => ({
    ...task_comments,
    user: users,
  }));

  return c.json({ comments });
});

tasksRouter.post("/tasks/:id/comments", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ content: string }>();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDb();

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  if (task.teamId) {
    const member = await getTeamMember(task.teamId, userId);
    if (!member) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  const commentId = generateId();
  const now = new Date().toISOString();

  const [comment] = await db
    .insert(taskComments)
    .values({
      id: commentId,
      taskId: id,
      userId,
      content: body.content,
      createdAt: now,
    })
    .returning();

  return c.json({ comment }, 201);
});

tasksRouter.get("/tasks/:id/events", async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  const result = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, id))
    .orderBy(desc(taskEvents.createdAt));

  return c.json({ events: result });
});
