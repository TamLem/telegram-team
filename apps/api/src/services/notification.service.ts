import { getDb } from "@telegram-team/db";
import { notifications, users as usersTable } from "@telegram-team/db";
import { eq, isNull, asc } from "drizzle-orm";
import { generateId, type NotificationPayload } from "@telegram-team/shared";

export async function createNotification(input: {
  taskId?: string | null;
  teamId?: string | null;
  recipientUserId: string;
  actorUserId: string;
  eventType: string;
  payload: NotificationPayload;
}): Promise<void> {
  const db = getDb();
  await db.insert(notifications).values({
    id: generateId(),
    taskId: input.taskId ?? null,
    teamId: input.teamId ?? null,
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    payload: JSON.stringify(input.payload),
    createdAt: new Date().toISOString(),
  });
}

export interface NotificationWithRecipient {
  id: string;
  taskId: string | null;
  teamId: string | null;
  eventType: string;
  payload: string | null;
  createdAt: string;
  recipientTelegramUserId: number;
  recipientFirstName: string;
}

export async function getUndeliveredNotifications(
  limit = 50
): Promise<NotificationWithRecipient[]> {
  const db = getDb();
  const result = await db
    .select({
      id: notifications.id,
      taskId: notifications.taskId,
      teamId: notifications.teamId,
      eventType: notifications.eventType,
      payload: notifications.payload,
      createdAt: notifications.createdAt,
      recipientTelegramUserId: usersTable.telegramUserId,
      recipientFirstName: usersTable.firstName,
    })
    .from(notifications)
    .innerJoin(
      usersTable,
      eq(notifications.recipientUserId, usersTable.id)
    )
    .where(isNull(notifications.deliveredAt))
    .orderBy(asc(notifications.createdAt))
    .limit(limit);

  return result;
}

export async function markNotificationDelivered(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(notifications)
    .set({ deliveredAt: new Date().toISOString() })
    .where(eq(notifications.id, id));
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
