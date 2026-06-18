import { getDb } from "@telegram-team/db";
import { teams } from "@telegram-team/db";
import { eq } from "drizzle-orm";
import { generateId, slugify } from "@telegram-team/shared";
import type { Team } from "@telegram-team/shared";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createTeam(input: {
  name: string;
  createdByUserId: string;
}): Promise<Team> {
  const db = getDb();
  const now = new Date().toISOString();

  const slug = slugify(input.name) + "-" + generateId().slice(0, 6);

  const [team] = await db
    .insert(teams)
    .values({
      id: generateId(),
      name: input.name,
      slug,
      inviteCode: generateInviteCode(),
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return team;
}

export async function getTeamById(id: string): Promise<Team | undefined> {
  const db = getDb();
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, id))
    .limit(1);
  return team;
}

export async function getTeamByInviteCode(
  inviteCode: string
): Promise<Team | undefined> {
  const db = getDb();
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.inviteCode, inviteCode))
    .limit(1);
  return team;
}

export async function getUserTeams(userId: string): Promise<Team[]> {
  const db = getDb();
  return db.select().from(teams).where(eq(teams.createdByUserId, userId));
}

export async function updateTeamName(
  teamId: string,
  name: string
): Promise<Team> {
  const db = getDb();
  const [team] = await db
    .update(teams)
    .set({ name, updatedAt: new Date().toISOString() })
    .where(eq(teams.id, teamId))
    .returning();
  return team;
}

export async function regenerateInviteCode(teamId: string): Promise<Team> {
  const db = getDb();
  const [team] = await db
    .update(teams)
    .set({
      inviteCode: generateInviteCode(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(teams.id, teamId))
    .returning();
  return team;
}
