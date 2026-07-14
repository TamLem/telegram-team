import { Hono } from "hono";
import { findOrCreateTelegramUser, getUserById, getUserByTelegramId } from "../services/users.service.js";
import {
  getPreferredTeamId,
  getUserActiveTeams,
  resolvePreferredTeamId,
  setPreferredTeam,
} from "../services/membership.service.js";

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

  const preferredTeamId = await resolvePreferredTeamId(userId);
  return c.json({ user, preferredTeamId });
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
  const storedPreferred = await getPreferredTeamId(userId);
  const preferredTeamId =
    storedPreferred ?? (teams[0]?.id as string | undefined) ?? null;

  return c.json({ teams, preferredTeamId });
});

usersRouter.put("/me/preferred-team", async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { teamId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const teamId = body.teamId?.trim();
  if (!teamId) {
    return c.json({ error: "teamId is required" }, 400);
  }

  try {
    const preferredTeamId = await setPreferredTeam(userId, teamId);
    return c.json({ preferredTeamId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set preferred team";
    if (message.includes("not an active member")) {
      return c.json({ error: message }, 403);
    }
    return c.json({ error: message }, 400);
  }
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
