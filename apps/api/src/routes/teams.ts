import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createTeamSchema, addTeamMemberSchema } from "@telegram-team/shared";
import { getDb } from "@telegram-team/db";
import { teams, teamMembers, users } from "@telegram-team/db";
import { eq, and } from "drizzle-orm";
import { generateId } from "@telegram-team/shared";

export const teamsRouter = new Hono();

teamsRouter.get("/teams", async (c) => {
  const db = getDb();
  const result = await db.select().from(teams);
  return c.json({ teams: result });
});

teamsRouter.post("/teams", zValidator("json", createTeamSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb();

  const id = generateId();
  const now = new Date().toISOString();

  const [team] = await db
    .insert(teams)
    .values({
      id,
      name: body.name,
      ownerId: body.ownerId,
      createdAt: now,
    })
    .returning();

  return c.json({ team }, 201);
});

teamsRouter.get("/teams/:id/members", async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  const result = await db
    .select()
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, id));

  const members = result.map(({ team_members, users }) => ({
    ...team_members,
    user: users,
  }));

  return c.json({ members });
});

teamsRouter.post("/teams/:id/members", zValidator("json", addTeamMemberSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid("json");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, id), eq(teamMembers.userId, body.userId))
    )
    .limit(1);

  if (existing) {
    return c.json({ error: "Member already in team" }, 409);
  }

  const memberId = generateId();
  const now = new Date().toISOString();

  const [member] = await db
    .insert(teamMembers)
    .values({
      id: memberId,
      teamId: id,
      userId: body.userId,
      role: body.role ?? "member",
      joinedAt: now,
    })
    .returning();

  return c.json({ member }, 201);
});
