import { Hono } from "hono";
import { getDb } from "@telegram-team/db";
import { users } from "@telegram-team/db";
import { eq } from "drizzle-orm";
import { generateId } from "@telegram-team/shared";

export const usersRouter = new Hono();

// Upsert user by Telegram ID (used by bot)
usersRouter.put("/users/telegram/:telegramId", async (c) => {
  const telegramId = parseInt(c.req.param("telegramId"));
  const body = await c.req.json<{
    firstName: string;
    lastName?: string | null;
    username?: string | null;
  }>();

  const db = getDb();

  // Check if user exists
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  if (existing) {
    // Update existing user
    const [updated] = await db
      .update(users)
      .set({
        firstName: body.firstName,
        lastName: body.lastName ?? null,
        username: body.username ?? null,
      })
      .where(eq(users.id, existing.id))
      .returning();

    return c.json({ user: updated });
  }

  // Create new user
  const id = generateId();
  const [user] = await db
    .insert(users)
    .values({
      id,
      telegramId,
      firstName: body.firstName,
      lastName: body.lastName ?? null,
      username: body.username ?? null,
    })
    .returning();

  return c.json({ user }, 201);
});

// Get user by Telegram ID
usersRouter.get("/users/telegram/:telegramId", async (c) => {
  const telegramId = parseInt(c.req.param("telegramId"));
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});
