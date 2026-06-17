import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  assignTaskSchema,
  createCommentSchema,
  paginationSchema,
} from "@telegram-team/shared";
import { users as usersTable } from "@telegram-team/db";
import { eq } from "drizzle-orm";
import { getDb } from "@telegram-team/db";
import {
  createTask,
  getTaskById,
  listTasks,
  updateTask,
  updateTaskStatus,
  assignTask,
  addTaskComment,
  getTaskComments,
  getTaskEvents,
} from "../services/task.service.js";
import { getTeamMember, getUserActiveMemberships } from "../services/membership.service.js";
import { isAdminOrOwner } from "../services/authorization.service.js";

export const tasksRouter = new Hono();

function getUserId(c: any): string {
  return c.get("apiUser")?.id ?? c.req.header("X-User-Id") ?? "";
}

tasksRouter.get("/tasks", zValidator("query", paginationSchema), async (c) => {
  const { limit, offset } = c.req.valid("query");
  const teamId = c.req.query("team_id");
  const assignedTo = c.req.query("assigned_to");
  const createdBy = c.req.query("created_by");
  const status = c.req.query("status");
  const priority = c.req.query("priority");

  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const memberships = await getUserActiveMemberships(userId);
  const userTeamIds = memberships.map((m) => m.teamId);

  if (teamId && !userTeamIds.includes(teamId)) {
    return c.json({ error: "You are not a member of this team" }, 403);
  }

  const result = await listTasks({
    teamId: teamId ?? undefined,
    assignedToUserId: assignedTo === "me" ? userId : undefined,
    createdById: createdBy === "me" ? userId : undefined,
    status: status ?? undefined,
    priority: priority ?? undefined,
    limit,
    offset,
  });

  return c.json({
    tasks: result.tasks,
    total: result.total,
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

  const teamId = c.req.header("X-Team-Id");
  if (teamId) {
    const member = await getTeamMember(teamId, userId);
    if (!member) {
      return c.json({ error: "You are not a member of this team" }, 403);
    }

    const task = await createTask({
      title: body.title,
      teamId,
      createdById: userId,
      description: body.description,
      priority: body.priority,
      assignedToUserId: body.assignedToUserId,
      dueAt: body.dueAt,
    });

    return c.json({ task }, 201);
  }

  const memberships = await getUserActiveMemberships(userId);
  if (memberships.length === 0) {
    return c.json({ error: "You are not a member of any team" }, 403);
  }

  const defaultTeamId = memberships[0].teamId;

  const task = await createTask({
    title: body.title,
    teamId: defaultTeamId,
    createdById: userId,
    description: body.description,
    priority: body.priority,
    assignedToUserId: body.assignedToUserId,
    dueAt: body.dueAt,
  });

  return c.json({ task }, 201);
});

tasksRouter.get("/tasks/:taskId", async (c) => {
  const { taskId } = c.req.param();
  const task = await getTaskById(taskId);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const userId = getUserId(c);
  if (userId) {
    const member = await getTeamMember(task.teamId, userId);
    if (!member) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  return c.json({ task });
});

tasksRouter.patch("/tasks/:taskId", zValidator("json", updateTaskSchema), async (c) => {
  const { taskId } = c.req.param();
  const body = c.req.valid("json");
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const existing = await getTaskById(taskId);
  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const member = await getTeamMember(existing.teamId, userId);
  if (!member) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (
    !isAdminOrOwner(member.role) &&
    existing.createdById !== userId &&
    existing.assignedToUserId !== userId
  ) {
    return c.json({ error: "You do not have permission to update this task" }, 403);
  }

  const task = await updateTask(taskId, body, userId);
  if (!task) {
    return c.json({ error: "Failed to update task" }, 500);
  }

  return c.json({ task });
});

tasksRouter.post(
  "/tasks/:taskId/status",
  zValidator("json", updateTaskStatusSchema),
  async (c) => {
    const { taskId } = c.req.param();
    const { status } = c.req.valid("json");
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const existing = await getTaskById(taskId);
    if (!existing) {
      return c.json({ error: "Task not found" }, 404);
    }

    const member = await getTeamMember(existing.teamId, userId);
    if (!member) {
      return c.json({ error: "Access denied" }, 403);
    }

    if (
      !isAdminOrOwner(member.role) &&
      existing.createdById !== userId &&
      existing.assignedToUserId !== userId
    ) {
      return c.json({ error: "Permission denied" }, 403);
    }

    const task = await updateTaskStatus(taskId, status, userId);
    if (!task) {
      return c.json({ error: "Failed to update status" }, 500);
    }

    return c.json({ task });
  }
);

tasksRouter.post(
  "/tasks/:taskId/assign",
  zValidator("json", assignTaskSchema),
  async (c) => {
    const { taskId } = c.req.param();
    const { assignedToUserId } = c.req.valid("json");
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const existing = await getTaskById(taskId);
    if (!existing) {
      return c.json({ error: "Task not found" }, 404);
    }

    const member = await getTeamMember(existing.teamId, userId);
    if (!member) {
      return c.json({ error: "Access denied" }, 403);
    }

    if (!isAdminOrOwner(member.role)) {
      return c.json({ error: "Admin access required to assign tasks" }, 403);
    }

    const assignee = await getTeamMember(existing.teamId, assignedToUserId);
    if (!assignee) {
      return c.json({ error: "Assignee is not a member of this team" }, 400);
    }

    const task = await assignTask(taskId, assignedToUserId, userId);
    if (!task) {
      return c.json({ error: "Failed to assign task" }, 500);
    }

    return c.json({ task });
  }
);

tasksRouter.get("/tasks/:taskId/comments", async (c) => {
  const { taskId } = c.req.param();
  const db = getDb();

  const comments = await getTaskComments(taskId);

  const withUsers = await Promise.all(
    comments.map(async (comment) => {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, comment.userId))
        .limit(1);
      return { ...comment, user: user ?? null };
    })
  );

  return c.json({ comments: withUsers });
});

tasksRouter.post(
  "/tasks/:taskId/comments",
  zValidator("json", createCommentSchema),
  async (c) => {
    const { taskId } = c.req.param();
    const { body: bodyContent } = c.req.valid("json");
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const existing = await getTaskById(taskId);
    if (!existing) {
      return c.json({ error: "Task not found" }, 404);
    }

    const member = await getTeamMember(existing.teamId, userId);
    if (!member) {
      return c.json({ error: "Access denied" }, 403);
    }

    const comment = await addTaskComment({
      taskId,
      userId,
      body: bodyContent,
      teamId: existing.teamId,
    });

    return c.json({ comment }, 201);
  }
);

tasksRouter.get("/tasks/:taskId/events", async (c) => {
  const { taskId } = c.req.param();
  const events = await getTaskEvents(taskId);
  return c.json({ events });
});
