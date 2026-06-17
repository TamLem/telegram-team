import { Hono } from "hono";
import { findOrCreateTelegramUser, getUserById, getUserByTelegramId } from "../services/users.service.js";
import { getTeamMembers, getUserActiveMemberships, getUserActiveTeams } from "../services/membership.service.js";

export const usersRouter = new Hono();

function getUserId(c: any): string {
  return c.get("apiUser")?.id ?? c.req.header("X-User-Id") ?? "";
}

usersRouter.get("/me", async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await getUserById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});

usersRouter.get("/me/teams", async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const memberships = await getUserActiveTeams(userId);
  const teams = memberships.map((m) => ({
    ...m.team,
    role: m.role,
  }));

  return c.json({ teams });
});

usersRouter.put("/users/telegram/:telegramUserId", async (c) => {
  const rawId = c.req.param("telegramUserId");
  const telegramUserId = parseInt(rawId);
  if (isNaN(telegramUserId) || telegramUserId <= 0) {
    return c.json({ error: "Invalid Telegram user ID" }, 400);
  }
  const body = await c.req.json<{
    firstName: string;
    lastName?: string | null;
    telegramUsername?: string | null;
  }>();

  const user = await findOrCreateTelegramUser({
    telegramUserId,
    firstName: body.firstName,
    lastName: body.lastName ?? null,
    telegramUsername: body.telegramUsername ?? null,
  });

  return c.json({ user });
});

usersRouter.get("/users/telegram/:telegramUserId", async (c) => {
  const telegramUserId = parseInt(c.req.param("telegramUserId"));
  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  return c.json({ user });
});
