import { getDb } from "@telegram-team/db";
import { teamJoinRequests, users as usersTable } from "@telegram-team/db";
import { eq, and } from "drizzle-orm";
import { generateId, JoinRequestStatus } from "@telegram-team/shared";
import type { TeamJoinRequest, User } from "@telegram-team/shared";

export async function createJoinRequest(input: {
  teamId: string;
  userId: string;
}): Promise<TeamJoinRequest> {
  const db = getDb();

  const [existingPending] = await db
    .select()
    .from(teamJoinRequests)
    .where(
      and(
        eq(teamJoinRequests.teamId, input.teamId),
        eq(teamJoinRequests.userId, input.userId),
        eq(teamJoinRequests.status, JoinRequestStatus.PENDING)
      )
    )
    .limit(1);

  if (existingPending) {
    throw new Error("You already have a pending join request for this team");
  }

  const [request] = await db
    .insert(teamJoinRequests)
    .values({
      id: generateId(),
      teamId: input.teamId,
      userId: input.userId,
      status: JoinRequestStatus.PENDING,
      requestedAt: new Date().toISOString(),
    })
    .returning();

  return request;
}

export async function getJoinRequestById(
  id: string
): Promise<TeamJoinRequest | undefined> {
  const db = getDb();
  const [request] = await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.id, id))
    .limit(1);
  return request;
}

export async function getJoinRequestsForTeam(
  teamId: string
): Promise<(TeamJoinRequest & { user: User })[]> {
  const db = getDb();
  const result = await db
    .select()
    .from(teamJoinRequests)
    .innerJoin(usersTable, eq(teamJoinRequests.userId, usersTable.id))
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.status, JoinRequestStatus.PENDING)
      )
    )
    .orderBy(teamJoinRequests.requestedAt);

  return result.map(({ team_join_requests, users }) => ({
    ...team_join_requests,
    user: users,
  }));
}

export async function approveJoinRequest(input: {
  requestId: string;
  reviewerId: string;
}): Promise<TeamJoinRequest> {
  const db = getDb();

  const [request] = await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.id, input.requestId))
    .limit(1);

  if (!request) {
    throw new Error("Join request not found");
  }

  if (request.status !== JoinRequestStatus.PENDING) {
    throw new Error("Join request is not pending");
  }

  const now = new Date().toISOString();

  const [updated] = await db
    .update(teamJoinRequests)
    .set({
      status: JoinRequestStatus.APPROVED,
      reviewedAt: now,
      reviewedByUserId: input.reviewerId,
    })
    .where(eq(teamJoinRequests.id, input.requestId))
    .returning();

  return updated;
}

export async function rejectJoinRequest(input: {
  requestId: string;
  reviewerId: string;
}): Promise<TeamJoinRequest> {
  const db = getDb();

  const [request] = await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.id, input.requestId))
    .limit(1);

  if (!request) {
    throw new Error("Join request not found");
  }

  if (request.status !== JoinRequestStatus.PENDING) {
    throw new Error("Join request is not pending");
  }

  const now = new Date().toISOString();

  const [updated] = await db
    .update(teamJoinRequests)
    .set({
      status: JoinRequestStatus.REJECTED,
      reviewedAt: now,
      reviewedByUserId: input.reviewerId,
    })
    .where(eq(teamJoinRequests.id, input.requestId))
    .returning();

  return updated;
}
