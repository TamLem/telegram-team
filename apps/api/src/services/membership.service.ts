import { getDb } from "@telegram-team/db";
import { teamMembers, users as usersTable, teams as teamsTable } from "@telegram-team/db";
import { eq, and, or, desc, asc } from "drizzle-orm";
import { generateId, TeamRole, MembershipStatus } from "@telegram-team/shared";
import type { TeamMember, User, Team } from "@telegram-team/shared";

export async function addTeamMember(input: {
  teamId: string;
  userId: string;
  role?: string;
}): Promise<TeamMember> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, input.teamId),
        eq(teamMembers.userId, input.userId)
      )
    )
    .limit(1);

  if (existing) {
    if (existing.status === "active") {
      throw new Error("User is already an active member of this team");
    }

    const [updated] = await db
      .update(teamMembers)
      .set({
        status: MembershipStatus.ACTIVE,
        role: input.role ?? existing.role,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(teamMembers.id, existing.id))
      .returning();

    return updated;
  }

  const now = new Date().toISOString();

  const [member] = await db
    .insert(teamMembers)
    .values({
      id: generateId(),
      teamId: input.teamId,
      userId: input.userId,
      role: input.role ?? TeamRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return member;
}

export async function getTeamMembers(teamId: string): Promise<
  (TeamMember & { user: User })[]
> {
  const db = getDb();
  const result = await db
    .select()
    .from(teamMembers)
    .innerJoin(usersTable, eq(teamMembers.userId, usersTable.id))
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.status, MembershipStatus.ACTIVE)
      )
    );

  return result.map(({ team_members, users }) => ({
    ...team_members,
    user: users,
  }));
}

export async function getUserActiveTeams(
  userId: string
): Promise<(TeamMember & { team: Team })[]> {
  const db = getDb();

  const result = await db
    .select()
    .from(teamMembers)
    .innerJoin(teamsTable, eq(teamMembers.teamId, teamsTable.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, MembershipStatus.ACTIVE)
      )
    )
    .orderBy(desc(teamMembers.updatedAt), asc(teamsTable.name));

  return result.map(({ team_members, teams }) => ({
    ...team_members,
    team: teams as unknown as Team,
  }));
}

export async function getUserActiveMemberships(
  userId: string
): Promise<TeamMember[]> {
  const db = getDb();
  return db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, MembershipStatus.ACTIVE)
      )
    );
}

export async function getTeamMember(
  teamId: string,
  userId: string
): Promise<TeamMember | undefined> {
  const db = getDb();
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, MembershipStatus.ACTIVE)
      )
    )
    .limit(1);
  return member;
}

export async function isTeamAdmin(
  teamId: string,
  userId: string
): Promise<boolean> {
  const member = await getTeamMember(teamId, userId);
  if (!member) return false;
  return (
    member.role === TeamRole.OWNER || member.role === TeamRole.ADMIN
  );
}

export async function hasActiveTeam(userId: string): Promise<boolean> {
  const memberships = await getUserActiveMemberships(userId);
  return memberships.length > 0;
}

export async function removeTeamMember(
  teamId: string,
  userId: string
): Promise<TeamMember> {
  const db = getDb();
  const [updated] = await db
    .update(teamMembers)
    .set({
      status: MembershipStatus.REMOVED,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, MembershipStatus.ACTIVE)
      )
    )
    .returning();
  if (!updated) throw new Error("Member not found");

  // Clear preferred team if it pointed at the removed membership.
  await db
    .update(usersTable)
    .set({
      preferredTeamId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(eq(usersTable.id, userId), eq(usersTable.preferredTeamId, teamId))
    );

  return updated;
}

export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: string
): Promise<TeamMember> {
  const db = getDb();
  const [updated] = await db
    .update(teamMembers)
    .set({ role, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, MembershipStatus.ACTIVE)
      )
    )
    .returning();
  if (!updated) throw new Error("Member not found");
  return updated;
}

export async function getAdminsForTeam(
  teamId: string
): Promise<TeamMember[]> {
  const db = getDb();
  return db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.status, MembershipStatus.ACTIVE),
        or(
          eq(teamMembers.role, TeamRole.OWNER),
          eq(teamMembers.role, TeamRole.ADMIN)
        )
      )
    );
}

export async function resolveActiveTeamForUser(
  userId: string
): Promise<(TeamMember & { team: Team }) | null> {
  const teams = await getUserActiveTeams(userId);
  if (teams.length === 0) return null;

  const [user] = await getDb()
    .select({ preferredTeamId: usersTable.preferredTeamId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (user?.preferredTeamId) {
    const preferred = teams.find((t) => t.teamId === user.preferredTeamId);
    if (preferred) return preferred;
  }

  return teams[0];
}

/**
 * Preferred team id if still an active member; otherwise first active membership.
 */
export async function resolvePreferredTeamId(
  userId: string
): Promise<string | null> {
  const resolved = await resolveActiveTeamForUser(userId);
  return resolved?.teamId ?? null;
}

export async function setPreferredTeam(
  userId: string,
  teamId: string
): Promise<string> {
  const member = await getTeamMember(teamId, userId);
  if (!member) {
    throw new Error("You are not an active member of this team");
  }

  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(usersTable)
    .set({ preferredTeamId: teamId, updatedAt: now })
    .where(eq(usersTable.id, userId));

  // Touch membership so getUserActiveTeams stable order stays useful.
  await db
    .update(teamMembers)
    .set({ updatedAt: now })
    .where(eq(teamMembers.id, member.id));

  return teamId;
}

export async function getPreferredTeamId(
  userId: string
): Promise<string | null> {
  const db = getDb();
  const [user] = await db
    .select({ preferredTeamId: usersTable.preferredTeamId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user?.preferredTeamId) return null;

  const member = await getTeamMember(user.preferredTeamId, userId);
  if (!member) {
    // Stale preferred — clear and return null so callers fall back.
    await db
      .update(usersTable)
      .set({ preferredTeamId: null, updatedAt: new Date().toISOString() })
      .where(eq(usersTable.id, userId));
    return null;
  }

  return user.preferredTeamId;
}
