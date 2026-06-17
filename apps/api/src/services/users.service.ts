import { getDb } from "@telegram-team/db";
import { users } from "@telegram-team/db";
import { eq } from "drizzle-orm";
import { generateId } from "@telegram-team/shared";
import type { User } from "@telegram-team/shared";

export async function findOrCreateTelegramUser(input: {
  telegramUserId: number;
  firstName: string;
  lastName?: string | null;
  telegramUsername?: string | null;
}): Promise<User> {
  if (isNaN(input.telegramUserId) || input.telegramUserId <= 0) {
    throw new Error("Invalid telegramUserId");
  }
  if (!input.firstName) {
    throw new Error("firstName is required");
  }

  const db = getDb();

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.telegramUserId, input.telegramUserId))
    .limit(1);

  const now = new Date().toISOString();

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        telegramUsername: input.telegramUsername ?? null,
        updatedAt: now,
        lastSeenAt: now,
      })
      .where(eq(users.id, existing.id))
      .returning();

    return updated;
  }

  const [user] = await db
    .insert(users)
    .values({
      id: generateId(),
      telegramUserId: input.telegramUserId,
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      telegramUsername: input.telegramUsername ?? null,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    })
    .returning();

  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user;
}

export async function getUserByTelegramId(
  telegramUserId: number
): Promise<User | undefined> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramUserId, telegramUserId))
    .limit(1);
  return user;
}
