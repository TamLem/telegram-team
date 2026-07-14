import { getDb } from "@telegram-team/db";
import {
  tasks,
  taskComments,
  taskEvents,
  notifications,
  users as usersTable,
  teams as teamsTable,
} from "@telegram-team/db";
import { eq, desc, and, inArray, lt, isNull, isNotNull, ne, or, sql } from "drizzle-orm";
import { generateId, TaskStatus, TaskEventType } from "@telegram-team/shared";
import type { Task, TaskComment, TaskEvent, NotificationPayload } from "@telegram-team/shared";
import { createNotification } from "./notification.service.js";
import { recordTaskEvent } from "./events.service.js";

export type TaskWithTeam = Task & { teamName?: string | null };

async function getUserName(userId: string): Promise<string> {
  const db = getDb();
  const [user] = await db
    .select({ firstName: usersTable.firstName })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return user?.firstName ?? "Someone";
}

async function getTeamName(teamId: string): Promise<string | null> {
  const db = getDb();
  const [team] = await db
    .select({ name: teamsTable.name })
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  return team?.name ?? null;
}

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

  const actorName = await getUserName(input.createdById);
  const assigneeName = input.assignedToUserId
    ? await getUserName(input.assignedToUserId)
    : null;

  const payload: NotificationPayload = {
    taskTitle: input.title,
    taskStatus: "todo",
    taskPriority: input.priority ?? "normal",
    assigneeName,
    actorName,
    taskId: id,
    teamId: input.teamId,
    teamName: (await getTeamName(input.teamId)) ?? undefined,
    dueAt: input.dueAt ?? null,
  };

  await createNotification({
    taskId: id,
    teamId: input.teamId,
    recipientUserId: input.createdById,
    actorUserId: input.createdById,
    eventType: "task_created",
    payload,
  });

  if (input.assignedToUserId && input.assignedToUserId !== input.createdById) {
    await createNotification({
      taskId: id,
      teamId: input.teamId,
      recipientUserId: input.assignedToUserId,
      actorUserId: input.createdById,
      eventType: "task_assigned",
      payload,
    });
  }

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
  /** When set (and teamId omitted), restrict to these team ids. Empty → no rows. */
  teamIds?: string[];
  assignedToUserId?: string;
  createdById?: string;
  status?: string;
  priority?: string;
  limit?: number;
  offset?: number;
  includeTeamName?: boolean;
}): Promise<{ tasks: TaskWithTeam[]; total: number }> {
  const db = getDb();
  const conditions = [];

  if (params.teamId) {
    conditions.push(eq(tasks.teamId, params.teamId));
  } else if (params.teamIds) {
    if (params.teamIds.length === 0) {
      return { tasks: [], total: 0 };
    }
    conditions.push(inArray(tasks.teamId, params.teamIds));
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

  if (params.includeTeamName) {
    const result = await db
      .select({
        task: tasks,
        teamName: teamsTable.name,
      })
      .from(tasks)
      .leftJoin(teamsTable, eq(tasks.teamId, teamsTable.id))
      .where(where)
      .orderBy(desc(tasks.updatedAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(where);

    return {
      tasks: result.map(({ task, teamName }) => ({
        ...task,
        teamName: teamName ?? null,
      })),
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  const result = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(where);

  return {
    tasks: result,
    total: Number(countResult[0]?.count ?? 0),
  };
}

export async function getMyTaskSummary(
  userId: string,
  teamIds: string[]
): Promise<{
  total: number;
  todo: number;
  doing: number;
  blocked: number;
  done: number;
  cancelled: number;
  byTeam: Array<{
    teamId: string;
    teamName: string;
    total: number;
    todo: number;
    doing: number;
    blocked: number;
  }>;
  tasks: TaskWithTeam[];
}> {
  if (teamIds.length === 0) {
    return {
      total: 0,
      todo: 0,
      doing: 0,
      blocked: 0,
      done: 0,
      cancelled: 0,
      byTeam: [],
      tasks: [],
    };
  }

  const { tasks: myTasks } = await listTasks({
    teamIds,
    assignedToUserId: userId,
    limit: 100,
    offset: 0,
    includeTeamName: true,
  });

  const openStatuses = new Set(["todo", "doing", "blocked"]);
  const summary = {
    total: myTasks.length,
    todo: 0,
    doing: 0,
    blocked: 0,
    done: 0,
    cancelled: 0,
    byTeam: [] as Array<{
      teamId: string;
      teamName: string;
      total: number;
      todo: number;
      doing: number;
      blocked: number;
    }>,
    tasks: myTasks.filter((t) => openStatuses.has(t.status)),
  };

  const byTeamMap = new Map<
    string,
    {
      teamId: string;
      teamName: string;
      total: number;
      todo: number;
      doing: number;
      blocked: number;
    }
  >();

  for (const t of myTasks) {
    if (t.status === "todo") summary.todo++;
    else if (t.status === "doing") summary.doing++;
    else if (t.status === "blocked") summary.blocked++;
    else if (t.status === "done") summary.done++;
    else if (t.status === "cancelled") summary.cancelled++;

    if (!openStatuses.has(t.status)) continue;

    let entry = byTeamMap.get(t.teamId);
    if (!entry) {
      entry = {
        teamId: t.teamId,
        teamName: t.teamName ?? "Team",
        total: 0,
        todo: 0,
        doing: 0,
        blocked: 0,
      };
      byTeamMap.set(t.teamId, entry);
    }
    entry.total++;
    if (t.status === "todo") entry.todo++;
    else if (t.status === "doing") entry.doing++;
    else if (t.status === "blocked") entry.blocked++;
  }

  summary.byTeam = Array.from(byTeamMap.values()).sort((a, b) =>
    a.teamName.localeCompare(b.teamName)
  );

  return summary;
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

export interface BoardSummary {
  teamId: string;
  totalTasks: number;
  todoCount: number;
  doingCount: number;
  blockedCount: number;
  doneCount: number;
  cancelledCount: number;
  dueSoonCount: number;
  overdueCount: number;
  unassignedCount: number;
  myTaskCount: number;
  topBlockedTasks: Array<{
    id: string;
    title: string;
    assignedToUserId: string | null;
    assigneeName: string | null;
  }>;
}

export async function getBoardSummary(
  teamId: string,
  requestedUserId: string
): Promise<BoardSummary> {
  const db = getDb();
  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.teamId, teamId));

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 2);
  const dueSoonCutoff = tomorrow.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const todoCount = allTasks.filter((t) => t.status === "todo").length;
  const doingCount = allTasks.filter((t) => t.status === "doing").length;
  const blockedCount = allTasks.filter((t) => t.status === "blocked").length;
  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const cancelledCount = allTasks.filter((t) => t.status === "cancelled").length;

  const dueSoonCount = allTasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "cancelled" &&
      t.dueAt &&
      t.dueAt <= dueSoonCutoff &&
      t.dueAt >= todayStr
  ).length;

  const overdueCount = allTasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "cancelled" &&
      t.dueAt &&
      t.dueAt < todayStr
  ).length;

  const unassignedCount = allTasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "cancelled" &&
      !t.assignedToUserId
  ).length;

  const myTaskCount = allTasks.filter(
    (t) =>
      t.assignedToUserId === requestedUserId &&
      t.status !== "done" &&
      t.status !== "cancelled"
  ).length;

  const blockedTasks = allTasks.filter((t) => t.status === "blocked");
  const topBlockedTasks = await Promise.all(
    blockedTasks.slice(0, 5).map(async (t) => ({
      id: t.id,
      title: t.title,
      assignedToUserId: t.assignedToUserId,
      assigneeName: t.assignedToUserId
        ? await getUserName(t.assignedToUserId)
        : null,
    }))
  );

  return {
    teamId,
    totalTasks: allTasks.length,
    todoCount,
    doingCount,
    blockedCount,
    doneCount,
    cancelledCount,
    dueSoonCount,
    overdueCount,
    unassignedCount,
    myTaskCount,
    topBlockedTasks,
  };
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

  if (input.dueAt !== undefined && input.dueAt !== existing.dueAt) {
    await recordTaskEvent({
      taskId: id,
      teamId: existing.teamId,
      actorUserId,
      eventType: TaskEventType.DUE_DATE_CHANGED,
      oldValue: existing.dueAt ?? "none",
      newValue: input.dueAt ?? "none",
    });
  }

  const [task] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();

  if (input.status !== undefined && input.status !== existing.status) {
    const actorName = await getUserName(actorUserId);
    const payload: NotificationPayload = {
      taskTitle: existing.title,
      oldStatus: existing.status,
      newStatus: input.status,
      actorName,
      taskId: id,
      teamId: existing.teamId,
      teamName: (await getTeamName(existing.teamId)) ?? undefined,
    };

    const eventType = input.status === TaskStatus.BLOCKED
      ? "task_blocked"
      : input.status === TaskStatus.DONE
        ? "task_completed"
        : "task_status_changed";

    await createNotification({
      taskId: id,
      teamId: existing.teamId,
      recipientUserId: actorUserId,
      actorUserId,
      eventType,
      payload,
    });

    if (existing.assignedToUserId && existing.assignedToUserId !== actorUserId) {
      await createNotification({
        taskId: id,
        teamId: existing.teamId,
        recipientUserId: existing.assignedToUserId,
        actorUserId,
        eventType,
        payload,
      });
    }
  }

  if (
    input.assignedToUserId !== undefined &&
    input.assignedToUserId !== existing.assignedToUserId
  ) {
    const actorName = await getUserName(actorUserId);
    const assigneeName = input.assignedToUserId
      ? await getUserName(input.assignedToUserId)
      : null;
    const payload: NotificationPayload = {
      taskTitle: existing.title,
      assigneeName,
      actorName,
      taskId: id,
      teamId: existing.teamId,
      teamName: (await getTeamName(existing.teamId)) ?? undefined,
      taskPriority: existing.priority,
      dueAt: existing.dueAt ?? null,
    };

    if (input.assignedToUserId && input.assignedToUserId !== actorUserId) {
      await createNotification({
        taskId: id,
        teamId: existing.teamId,
        recipientUserId: input.assignedToUserId,
        actorUserId,
        eventType: "task_assigned",
        payload,
      });
    }
  }

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

  const actorName = await getUserName(input.userId);

  const payload: NotificationPayload = {
    taskTitle: undefined,
    actorName,
    commentBody: input.body,
    taskId: input.taskId,
    teamId: input.teamId,
    teamName: (await getTeamName(input.teamId)) ?? undefined,
  };

  const task = await getTaskById(input.taskId);
  if (task) {
    payload.taskTitle = task.title;

    const recipients = new Set<string>();
    if (task.createdById && task.createdById !== input.userId) {
      recipients.add(task.createdById);
    }
    if (task.assignedToUserId && task.assignedToUserId !== input.userId) {
      recipients.add(task.assignedToUserId);
    }

    for (const recipientId of recipients) {
      await createNotification({
        taskId: input.taskId,
        teamId: input.teamId,
        recipientUserId: recipientId,
        actorUserId: input.userId,
        eventType: "task_commented",
        payload,
      });
    }
  }

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

export async function processDeadlineAlerts(): Promise<{
  dueSoon: number;
  overdue: number;
}> {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);

  const activeTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        ne(tasks.status, "done"),
        ne(tasks.status, "cancelled"),
        isNotNull(tasks.dueAt),
        isNotNull(tasks.assignedToUserId)
      )
    );

  let dueSoon = 0;
  let overdue = 0;

  for (const task of activeTasks) {
    if (!task.dueAt || !task.assignedToUserId) continue;

    const dueDate = new Date(task.dueAt);
    const isOverdue = dueDate < now && task.dueAt.slice(0, 10) < todayStr;
    const isDueSoon = !isOverdue && dueDate <= twentyFourHoursFromNow;

    const alreadyRemindedRecently =
      task.lastRemindedAt && task.lastRemindedAt > twelveHoursAgo;

    if (isOverdue) {
      const alreadyRemindedToday =
        task.lastRemindedAt &&
        task.lastRemindedAt.slice(0, 10) === todayStr;
      if (alreadyRemindedToday) continue;
    } else if (isDueSoon) {
      if (alreadyRemindedRecently) continue;
    } else {
      continue;
    }

    const actorName = task.assignedToUserId
      ? await getUserName(task.assignedToUserId)
      : "Someone";
    const eventType = isOverdue ? "task_overdue" : "task_due_soon";

    const payload: NotificationPayload = {
      taskTitle: task.title,
      taskPriority: task.priority,
      assigneeName: actorName,
      taskId: task.id,
      teamId: task.teamId,
      teamName: (await getTeamName(task.teamId)) ?? undefined,
      dueAt: task.dueAt,
    };

    await createNotification({
      taskId: task.id,
      teamId: task.teamId,
      recipientUserId: task.assignedToUserId,
      actorUserId: task.assignedToUserId,
      eventType,
      payload,
    });

    await db
      .update(tasks)
      .set({ lastRemindedAt: nowIso })
      .where(eq(tasks.id, task.id));

    if (isOverdue) overdue++;
    else dueSoon++;
  }

  return { dueSoon, overdue };
}

export async function notifyAssignee(
  taskId: string,
  actorUserId: string
): Promise<{ ok: boolean }> {
  const task = await getTaskById(taskId);
  if (!task || !task.assignedToUserId) {
    return { ok: false };
  }

  const actorName = await getUserName(actorUserId);
  const assigneeName = await getUserName(task.assignedToUserId);

  const payload: NotificationPayload = {
    taskTitle: task.title,
    taskPriority: task.priority,
    assigneeName,
    actorName,
    taskId: task.id,
    teamId: task.teamId,
    teamName: (await getTeamName(task.teamId)) ?? undefined,
    dueAt: task.dueAt ?? null,
  };

  await createNotification({
    taskId: task.id,
    teamId: task.teamId,
    recipientUserId: task.assignedToUserId,
    actorUserId,
    eventType: "assignee_reminded",
    payload,
  });

  return { ok: true };
}

export async function deleteTask(
  taskId: string,
  actorUserId: string
): Promise<boolean> {
  const db = getDb();
  const task = await getTaskById(taskId);
  if (!task) return false;

  await db.delete(notifications).where(eq(notifications.taskId, taskId));
  await db.delete(taskEvents).where(eq(taskEvents.taskId, taskId));
  await db.delete(taskComments).where(eq(taskComments.taskId, taskId));
  await db.delete(tasks).where(eq(tasks.id, taskId));

  return true;
}
