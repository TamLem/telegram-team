import { getDb } from "@telegram-team/db";
import { tasks, taskComments, taskEvents } from "@telegram-team/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { generateId, TaskStatus, TaskEventType } from "@telegram-team/shared";
import type { Task, TaskComment, TaskEvent } from "@telegram-team/shared";

export async function createTask(input: {
  title: string;
  teamId: string;
  createdById: string;
  description?: string | null;
  priority?: string;
  assignedToUserId?: string | null;
  dueAt?: string | null;
}): Promise<Task> {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const [task] = await db
    .insert(tasks)
    .values({
      id,
      title: input.title,
      teamId: input.teamId,
      createdById: input.createdById,
      description: input.description ?? null,
      priority: input.priority ?? "normal",
      assignedToUserId: input.assignedToUserId ?? null,
      dueAt: input.dueAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await recordTaskEvent({
    taskId: id,
    teamId: input.teamId,
    actorUserId: input.createdById,
    eventType: TaskEventType.TASK_CREATED,
    newValue: JSON.stringify({ title: input.title }),
  });

  return task;
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  const db = getDb();
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);
  return task;
}

export async function listTasks(params: {
  teamId?: string;
  assignedToUserId?: string;
  createdById?: string;
  status?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tasks: Task[]; total: number }> {
  const db = getDb();
  const conditions = [];

  if (params.teamId) {
    conditions.push(eq(tasks.teamId, params.teamId));
  }
  if (params.assignedToUserId) {
    conditions.push(eq(tasks.assignedToUserId, params.assignedToUserId));
  }
  if (params.createdById) {
    conditions.push(eq(tasks.createdById, params.createdById));
  }
  if (params.status) {
    conditions.push(eq(tasks.status, params.status));
  }
  if (params.priority) {
    conditions.push(eq(tasks.priority, params.priority));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const result = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: tasks.id })
    .from(tasks)
    .where(where);

  return {
    tasks: result,
    total: countResult.length,
  };
}

export async function listMyTasks(userId: string, teamIds: string[]): Promise<Task[]> {
  const db = getDb();
  return db
    .select()
    .from(tasks)
    .where(
      and(
        inArray(tasks.teamId, teamIds),
        eq(tasks.assignedToUserId, userId)
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(50);
}

interface BoardColumn {
  status: string;
  label: string;
  tasks: Task[];
  count: number;
}

const BOARD_COLUMNS = [
  { status: TaskStatus.TODO, label: "Todo" },
  { status: TaskStatus.DOING, label: "Doing" },
  { status: TaskStatus.BLOCKED, label: "Blocked" },
  { status: TaskStatus.DONE, label: "Done" },
  { status: TaskStatus.CANCELLED, label: "Cancelled" },
];

export async function listTeamBoard(teamId: string): Promise<BoardColumn[]> {
  const db = getDb();
  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.teamId, teamId))
    .orderBy(desc(tasks.updatedAt));

  return BOARD_COLUMNS.map((col) => {
    const colTasks = allTasks.filter((t) => t.status === col.status);
    return {
      status: col.status,
      label: col.label,
      tasks: colTasks,
      count: colTasks.length,
    };
  });
}

export async function updateTask(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    assignedToUserId?: string | null;
    dueAt?: string | null;
  },
  actorUserId: string
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

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.assignedToUserId !== undefined) updates.assignedToUserId = input.assignedToUserId;
  if (input.dueAt !== undefined) updates.dueAt = input.dueAt;

  if (input.status !== undefined) {
    updates.status = input.status;

    if (input.status === TaskStatus.DONE) {
      updates.completedAt = new Date().toISOString();
      updates.cancelledAt = null;
    } else if (input.status === TaskStatus.CANCELLED) {
      updates.cancelledAt = new Date().toISOString();
      updates.completedAt = null;
    } else {
      updates.completedAt = null;
      updates.cancelledAt = null;
    }

    if (input.status !== existing.status) {
      const eventType = input.status === TaskStatus.DONE
        ? TaskEventType.TASK_COMPLETED
        : input.status === TaskStatus.CANCELLED
          ? TaskEventType.TASK_CANCELLED
          : TaskEventType.STATUS_CHANGED;

      await recordTaskEvent({
        taskId: id,
        teamId: existing.teamId,
        actorUserId,
        eventType,
        oldValue: existing.status,
        newValue: input.status,
      });
    }
  }

  if (input.priority !== undefined && input.priority !== existing.priority) {
    await recordTaskEvent({
      taskId: id,
      teamId: existing.teamId,
      actorUserId,
      eventType: TaskEventType.PRIORITY_CHANGED,
      oldValue: existing.priority,
      newValue: input.priority,
    });
  }

  if (
    input.assignedToUserId !== undefined &&
    input.assignedToUserId !== existing.assignedToUserId
  ) {
    await recordTaskEvent({
      taskId: id,
      teamId: existing.teamId,
      actorUserId,
      eventType: TaskEventType.ASSIGNEE_CHANGED,
      oldValue: existing.assignedToUserId ?? "unassigned",
      newValue: input.assignedToUserId ?? "unassigned",
    });
  }

  const [task] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();

  return task;
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  actorUserId: string
): Promise<Task | null> {
  return updateTask(taskId, { status }, actorUserId);
}

export async function assignTask(
  taskId: string,
  assignedToUserId: string,
  actorUserId: string
): Promise<Task | null> {
  return updateTask(taskId, { assignedToUserId }, actorUserId);
}

export async function addTaskComment(input: {
  taskId: string;
  userId: string;
  body: string;
  teamId: string;
}): Promise<TaskComment> {
  const db = getDb();

  const [comment] = await db
    .insert(taskComments)
    .values({
      id: generateId(),
      taskId: input.taskId,
      userId: input.userId,
      body: input.body,
      createdAt: new Date().toISOString(),
    })
    .returning();

  await recordTaskEvent({
    taskId: input.taskId,
    teamId: input.teamId,
    actorUserId: input.userId,
    eventType: TaskEventType.COMMENT_ADDED,
  });

  return comment;
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const db = getDb();
  return db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(taskComments.createdAt);
}

export async function getTaskEvents(taskId: string): Promise<TaskEvent[]> {
  const db = getDb();
  return db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(desc(taskEvents.createdAt));
}

async function recordTaskEvent(input: {
  taskId: string;
  teamId: string;
  actorUserId: string;
  eventType: string;
  oldValue?: string | null;
  newValue?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(taskEvents).values({
    id: generateId(),
    taskId: input.taskId,
    teamId: input.teamId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    createdAt: new Date().toISOString(),
  });
}
