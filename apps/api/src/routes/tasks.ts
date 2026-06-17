import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createTaskSchema, updateTaskSchema, paginationSchema } from "@telegram-team/shared";
import { getDb } from "@telegram-team/db";
import { tasks, users } from "@telegram-team/db";
import { eq, desc, count, and, like } from "drizzle-orm";
import { generateId } from "@telegram-team/shared";

export const tasksRouter = new Hono();

tasksRouter.get("/tasks", zValidator("query", paginationSchema), async (c) => {
  const { limit, offset } = c.req.valid("query");
  const db = getDb();

  const [total] = await db.select({ count: count() }).from(tasks);

  const result = await db
    .select()
    .from(tasks)
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
      teamId: body.teamId ?? null,
      createdById: body.createdById,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ task }, 201);
});

tasksRouter.get("/tasks/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ task });
});

tasksRouter.patch("/tasks/:id", zValidator("json", updateTaskSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid("json");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
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

  return c.json({ task });
});
