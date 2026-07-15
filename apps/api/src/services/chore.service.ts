import { getDb } from "@telegram-team/db";
import {
  chores,
  users as usersTable,
  teams as teamsTable,
} from "@telegram-team/db";
import { eq, and, asc, desc } from "drizzle-orm";
import {
  generateId,
  ChoreInterval,
  type Chore,
  type NotificationPayload,
} from "@telegram-team/shared";
import { createNotification } from "./notification.service.js";
import { getTeamMember, isTeamAdmin } from "./membership.service.js";

export function addInterval(
  fromIso: string,
  interval: string,
  intervalDays?: number | null
): string {
  const d = new Date(fromIso);
  switch (interval) {
    case ChoreInterval.DAILY:
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case ChoreInterval.WEEKLY:
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case ChoreInterval.BIWEEKLY:
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case ChoreInterval.MONTHLY:
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case ChoreInterval.CUSTOM: {
      const days =
        typeof intervalDays === "number" && intervalDays >= 1
          ? Math.min(intervalDays, 365)
          : 7;
      d.setUTCDate(d.getUTCDate() + days);
      break;
    }
    default:
      d.setUTCDate(d.getUTCDate() + 7);
  }
  return d.toISOString();
}

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

function mapRow(row: typeof chores.$inferSelect): Chore {
  return {
    id: row.id,
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    assigneeUserId: row.assigneeUserId,
    createdByUserId: row.createdByUserId,
    interval: row.interval,
    intervalDays: row.intervalDays ?? null,
    nextDueAt: row.nextDueAt,
    lastCompletedAt: row.lastCompletedAt,
    lastCompletedByUserId: row.lastCompletedByUserId,
    lastNotifiedAt: row.lastNotifiedAt,
    notifyEnabled: row.notifyEnabled ?? 1,
    remindOffsetMinutes: row.remindOffsetMinutes ?? 0,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Parse datetime-local / ISO into a stable ISO string. */
export function parseNextDueAt(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid due date/time");
  }
  return d.toISOString();
}

const VALID_INTERVALS = new Set<string>(Object.values(ChoreInterval));

function assertValidInterval(
  interval: string,
  intervalDays?: number | null
): void {
  if (!VALID_INTERVALS.has(interval)) {
    throw new Error(
      `Invalid interval (use daily, weekly, biweekly, monthly, or custom)`
    );
  }
  if (interval === ChoreInterval.CUSTOM) {
    if (
      typeof intervalDays !== "number" ||
      !Number.isFinite(intervalDays) ||
      intervalDays < 1 ||
      intervalDays > 365
    ) {
      throw new Error("Custom interval requires intervalDays between 1 and 365");
    }
  }
}

function normalizeIntervalDays(
  interval: string,
  intervalDays?: number | null
): number | null {
  if (interval === ChoreInterval.CUSTOM) {
    const n = intervalDays ?? 7;
    return Math.max(1, Math.min(365, Math.floor(n)));
  }
  return null;
}

export async function createChore(input: {
  teamId: string;
  title: string;
  description?: string | null;
  assigneeUserId: string;
  createdByUserId: string;
  interval: string;
  intervalDays?: number | null;
  nextDueAt?: string | null;
  dueImmediately?: boolean;
  notifyEnabled?: boolean;
  remindOffsetMinutes?: number;
}): Promise<Chore> {
  assertValidInterval(input.interval, input.intervalDays);
  const db = getDb();
  const now = new Date().toISOString();
  const intervalDays = normalizeIntervalDays(
    input.interval,
    input.intervalDays
  );

  let nextDueAt: string;
  if (input.nextDueAt) {
    nextDueAt = parseNextDueAt(input.nextDueAt);
  } else if (input.dueImmediately === false) {
    nextDueAt = addInterval(now, input.interval, intervalDays);
  } else {
    nextDueAt = now;
  }

  const notifyEnabled = input.notifyEnabled === false ? 0 : 1;
  const remindOffsetMinutes = Math.max(
    0,
    Math.min(10080 * 4, Math.floor(input.remindOffsetMinutes ?? 0))
  );

  const [row] = await db
    .insert(chores)
    .values({
      id: generateId(),
      teamId: input.teamId,
      title: input.title,
      description: input.description ?? null,
      assigneeUserId: input.assigneeUserId,
      createdByUserId: input.createdByUserId,
      interval: input.interval,
      intervalDays,
      nextDueAt,
      notifyEnabled,
      remindOffsetMinutes,
      active: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapRow(row);
}

export async function getChoreById(id: string): Promise<Chore | null> {
  const db = getDb();
  const [row] = await db.select().from(chores).where(eq(chores.id, id)).limit(1);
  return row ? mapRow(row) : null;
}

export async function listTeamChores(teamId: string): Promise<Chore[]> {
  const db = getDb();
  const rows = await db
    .select({
      chore: chores,
      assigneeName: usersTable.firstName,
    })
    .from(chores)
    .innerJoin(usersTable, eq(chores.assigneeUserId, usersTable.id))
    .where(eq(chores.teamId, teamId))
    .orderBy(desc(chores.active), asc(chores.nextDueAt));

  return rows.map(({ chore, assigneeName }) => ({
    ...mapRow(chore),
    assigneeName,
  }));
}

export async function listMyChores(userId: string): Promise<Chore[]> {
  const db = getDb();
  const rows = await db
    .select({
      chore: chores,
      teamName: teamsTable.name,
    })
    .from(chores)
    .innerJoin(teamsTable, eq(chores.teamId, teamsTable.id))
    .where(and(eq(chores.assigneeUserId, userId), eq(chores.active, 1)))
    .orderBy(asc(chores.nextDueAt));

  return rows.map(({ chore, teamName }) => ({
    ...mapRow(chore),
    teamName,
  }));
}

export async function updateChore(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    assigneeUserId?: string;
    interval?: string;
    intervalDays?: number | null;
    active?: boolean;
    nextDueAt?: string;
    notifyEnabled?: boolean;
    remindOffsetMinutes?: number;
  }
): Promise<Chore> {
  const db = getDb();
  const existing = await getChoreById(id);
  if (!existing) throw new Error("Chore not found");

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.assigneeUserId !== undefined)
    updates.assigneeUserId = patch.assigneeUserId;
  if (patch.interval !== undefined) updates.interval = patch.interval;
  if (patch.active !== undefined) updates.active = patch.active ? 1 : 0;
  if (patch.nextDueAt !== undefined) {
    updates.nextDueAt = parseNextDueAt(patch.nextDueAt);
    // Changing due resets notification for the new cycle
    updates.lastNotifiedAt = null;
  }
  if (patch.notifyEnabled !== undefined) {
    updates.notifyEnabled = patch.notifyEnabled ? 1 : 0;
  }
  if (patch.remindOffsetMinutes !== undefined) {
    updates.remindOffsetMinutes = Math.max(
      0,
      Math.min(10080 * 4, Math.floor(patch.remindOffsetMinutes))
    );
    updates.lastNotifiedAt = null;
  }

  if (patch.interval !== undefined || patch.intervalDays !== undefined) {
    const interval = patch.interval ?? existing.interval;
    const days =
      patch.intervalDays !== undefined
        ? patch.intervalDays
        : existing.intervalDays;
    assertValidInterval(interval, days);
    updates.intervalDays = normalizeIntervalDays(interval, days);
  }

  const [row] = await db
    .update(chores)
    .set(updates)
    .where(eq(chores.id, id))
    .returning();

  if (!row) throw new Error("Chore not found");
  return mapRow(row);
}

export async function canManageChore(
  chore: Chore,
  userId: string
): Promise<boolean> {
  const member = await getTeamMember(chore.teamId, userId);
  if (!member) return false;
  if (chore.createdByUserId === userId) return true;
  if (chore.assigneeUserId === userId) return true;
  return isTeamAdmin(chore.teamId, userId);
}

export async function canCompleteChore(
  chore: Chore,
  userId: string
): Promise<boolean> {
  const member = await getTeamMember(chore.teamId, userId);
  if (!member) return false;
  if (chore.assigneeUserId === userId) return true;
  return isTeamAdmin(chore.teamId, userId);
}

export async function completeChore(
  id: string,
  actorUserId: string
): Promise<Chore> {
  const chore = await getChoreById(id);
  if (!chore) throw new Error("Chore not found");
  if (!chore.active) throw new Error("Chore is paused");

  const allowed = await canCompleteChore(chore, actorUserId);
  if (!allowed) throw new Error("Not allowed to complete this chore");

  const now = new Date();
  const dueMs = new Date(chore.nextDueAt).getTime();
  const base = new Date(Math.max(now.getTime(), dueMs));
  const nextDueAt = addInterval(
    base.toISOString(),
    chore.interval,
    chore.intervalDays
  );

  const db = getDb();
  const [row] = await db
    .update(chores)
    .set({
      nextDueAt,
      lastCompletedAt: now.toISOString(),
      lastCompletedByUserId: actorUserId,
      lastNotifiedAt: null,
      updatedAt: now.toISOString(),
    })
    .where(eq(chores.id, id))
    .returning();

  return mapRow(row);
}

/**
 * Create chore_due notifications for active chores whose remind window
 * has opened (nextDueAt − remindOffsetMinutes ≤ now), once per due cycle.
 */
export async function processChoreDueAlerts(): Promise<{ due: number }> {
  const db = getDb();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Load active chores with notify on; filter by remind window in app
  // (offset varies per row).
  const candidates = await db
    .select()
    .from(chores)
    .where(and(eq(chores.active, 1), eq(chores.notifyEnabled, 1)));

  let due = 0;

  for (const row of candidates) {
    // Already notified for this due cycle.
    // New: lastNotifiedAt stores the nextDueAt cycle key.
    // Legacy: wall-clock ISO after due — treat as done for this cycle.
    if (
      row.lastNotifiedAt === row.nextDueAt ||
      (row.lastNotifiedAt &&
        row.lastNotifiedAt !== row.nextDueAt &&
        row.lastNotifiedAt >= row.nextDueAt)
    ) {
      continue;
    }

    const dueMs = new Date(row.nextDueAt).getTime();
    if (Number.isNaN(dueMs)) continue;

    const offsetMin = row.remindOffsetMinutes ?? 0;
    const remindAtMs = dueMs - Math.max(0, offsetMin) * 60_000;
    if (nowMs < remindAtMs) continue;

    // Skip assignees who left the team
    const assigneeMember = await getTeamMember(
      row.teamId,
      row.assigneeUserId
    );
    if (!assigneeMember) {
      continue;
    }

    const teamName = (await getTeamName(row.teamId)) ?? undefined;
    const payload: NotificationPayload = {
      choreId: row.id,
      choreTitle: row.title,
      taskTitle: row.title,
      choreInterval: row.interval,
      choreIntervalDays: row.intervalDays ?? null,
      teamId: row.teamId,
      teamName,
      dueAt: row.nextDueAt,
      assigneeName: await getUserName(row.assigneeUserId),
      remindOffsetMinutes: row.remindOffsetMinutes ?? 0,
    };

    await createNotification({
      taskId: null,
      teamId: row.teamId,
      recipientUserId: row.assigneeUserId,
      actorUserId: row.assigneeUserId,
      eventType: "chore_due",
      payload,
    });

    // Store cycle key so early offsets don't re-fire every poll
    await db
      .update(chores)
      .set({ lastNotifiedAt: row.nextDueAt, updatedAt: nowIso })
      .where(eq(chores.id, row.id));

    due++;
  }

  return { due };
}

export async function assertAssigneeIsMember(
  teamId: string,
  assigneeUserId: string
): Promise<void> {
  const member = await getTeamMember(teamId, assigneeUserId);
  if (!member) {
    throw new Error("Assignee must be an active team member");
  }
}
