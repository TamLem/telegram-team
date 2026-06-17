import { getDb } from "@telegram-team/db";
import { tasks, taskEvents } from "@telegram-team/db";
import { eq, desc, and } from "drizzle-orm";
import { generateId, TaskStatus } from "@telegram-team/shared";
import type { CreateTaskDto, UpdateTaskDto, Task } from "@telegram-team/shared";

export async function createTask(dto: CreateTaskDto & { createdById: string }): Promise<Task> {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const [task] = await db
    .insert(tasks)
    .values({
      id,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TaskStatus.TODO,
      priority: dto.priority ?? "medium",
      assigneeId: dto.assigneeId ?? null,
      teamId: dto.teamId ?? null,
      createdById: dto.createdById,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(taskEvents).values({
    id: generateId(),
    taskId: id,
    userId: dto.createdById,
    eventType: "created",
    createdAt: now,
  });

  return task;
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  const db = getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return task;
}

export async function listTasks(params: {
  limit?: number;
  offset?: number;
  assigneeId?: string;
  teamId?: string;
  status?: string;
}) {
  const db = getDb();
  const conditions = [];

  if (params.assigneeId) {
    conditions.push(eq(tasks.assigneeId, params.assigneeId));
  }
  if (params.teamId) {
    conditions.push(eq(tasks.teamId, params.teamId));
  }
  if (params.status) {
    conditions.push(eq(tasks.status, params.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(desc(tasks.updatedAt))
    .limit(params.limit ?? 20)
    .offset(params.offset ?? 0);

  return result;
}

export async function updateTask(
  id: string,
  dto: UpdateTaskDto,
  userId: string
): Promise<Task | null> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!existing) return null;

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (dto.title !== undefined) updates.title = dto.title;
  if (dto.description !== undefined) updates.description = dto.description;
  if (dto.status !== undefined) updates.status = dto.status;
  if (dto.priority !== undefined) updates.priority = dto.priority;
  if (dto.assigneeId !== undefined) updates.assigneeId = dto.assigneeId;

  const [task] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();

  // Record status change event
  if (dto.status !== undefined && dto.status !== existing.status) {
    await db.insert(taskEvents).values({
      id: generateId(),
      taskId: id,
      userId,
      eventType: "status_changed",
      data: JSON.stringify({
        from: existing.status,
        to: dto.status,
      }),
      createdAt: new Date().toISOString(),
    });
  }

  return task;
}

export async function getTaskEvents(taskId: string) {
  const db = getDb();
  return db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(desc(taskEvents.createdAt));
}
