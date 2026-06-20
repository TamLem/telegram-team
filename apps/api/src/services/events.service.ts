import { getDb } from "@telegram-team/db";
import { taskEvents, teamEvents } from "@telegram-team/db";
import { generateId } from "@telegram-team/shared";

export async function recordTaskEvent(input: {
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

export async function recordTeamEvent(input: {
  teamId: string;
  actorUserId: string;
  targetUserId?: string | null;
  eventType: string;
  oldValue?: string | null;
  newValue?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(teamEvents).values({
    id: generateId(),
    teamId: input.teamId,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId ?? null,
    eventType: input.eventType,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    createdAt: new Date().toISOString(),
  });
}
