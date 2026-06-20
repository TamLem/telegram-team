import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createTeamSchema, joinTeamSchema } from "@telegram-team/shared";
import { TeamRole, MembershipStatus, TeamEventType } from "@telegram-team/shared";
import { getDb, teamEvents, users as usersTable } from "@telegram-team/db";
import { eq, desc } from "drizzle-orm";
import {
  createTeam,
  getTeamById,
  getTeamByInviteCode,
  updateTeamName,
  regenerateInviteCode,
} from "../services/teams.service.js";
import { listTeamBoard, getBoardSummary } from "../services/task.service.js";
import {
  addTeamMember,
  getTeamMembers,
  getTeamMember,
  removeTeamMember,
  updateMemberRole,
  getAdminsForTeam,
} from "../services/membership.service.js";
import {
  createJoinRequest,
  getJoinRequestById,
  getJoinRequestsForTeam,
  approveJoinRequest,
  rejectJoinRequest,
} from "../services/joinRequests.service.js";
import { requireAdmin, isAdminOrOwner } from "../services/authorization.service.js";
import { getUserById } from "../services/users.service.js";
import { createNotification } from "../services/notification.service.js";
import { recordTeamEvent } from "../services/events.service.js";
import type { NotificationPayload } from "@telegram-team/shared";

export const teamsRouter = new Hono();

function getUserId(c: any): string {
  return c.get("apiUser")?.id ?? c.req.header("X-User-Id") ?? "";
}

teamsRouter.post("/teams", zValidator("json", createTeamSchema), async (c) => {
  const body = c.req.valid("json");
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const team = await createTeam({
    name: body.name,
    createdByUserId: userId,
  });

  await addTeamMember({
    teamId: team.id,
    userId,
    role: TeamRole.OWNER,
  });

  return c.json({ team }, 201);
});

teamsRouter.get("/teams/:teamId", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const team = await getTeamById(teamId);
  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }

  const member = await getTeamMember(teamId, userId);
  const requestId = c.req.query("request_id");
  if (!member) {
    const request = requestId ? await getJoinRequestById(requestId) : undefined;
    if (
      !request ||
      request.teamId !== teamId ||
      request.userId !== userId ||
      request.status !== "pending"
    ) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  const memberCount = (await getTeamMembers(teamId)).length;
  const pendingRequests = member && isAdminOrOwner(member.role)
    ? (await getJoinRequestsForTeam(teamId)).length
    : 0;

  return c.json({ team, memberCount, pendingRequestCount: pendingRequests });
});

teamsRouter.patch("/teams/:teamId", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  try {
    requireAdmin(member);
  } catch {
    return c.json({ error: "Admin access required" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return c.json({ error: "Team name is required" }, 400);
  }

  const team = await updateTeamName(teamId, body.name.trim());
  return c.json({ team });
});

teamsRouter.get("/teams/:teamId/members", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  if (!member) {
    return c.json({ error: "Access denied" }, 403);
  }

  const members = await getTeamMembers(teamId);
  return c.json({ members });
});

teamsRouter.post("/teams/:teamId/members/:memberUserId/remove", async (c) => {
  const { teamId, memberUserId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const actor = await getTeamMember(teamId, userId);
  try {
    requireAdmin(actor);
  } catch {
    return c.json({ error: "Admin access required" }, 403);
  }

  const target = await getTeamMember(teamId, memberUserId);
  if (!target) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (target.role === TeamRole.OWNER) {
    return c.json({ error: "Cannot remove the team owner" }, 403);
  }

  const admins = await getAdminsForTeam(teamId);
  const isLastAdmin =
    target.role === TeamRole.ADMIN &&
    admins.filter((a) => a.userId !== memberUserId).length === 0;
  if (isLastAdmin && admins.every((a) => a.userId === memberUserId)) {
    return c.json({ error: "Cannot remove the last admin" }, 403);
  }

  await removeTeamMember(teamId, memberUserId);

  await recordTeamEvent({
    teamId,
    actorUserId: userId,
    targetUserId: memberUserId,
    eventType: TeamEventType.MEMBER_REMOVED,
  });

  const team = await getTeamById(teamId);
  const removedUser = await getUserById(memberUserId);
  if (removedUser) {
    const payload: NotificationPayload = {
      taskTitle: team?.name ?? "Unknown team",
      teamId,
      memberName: removedUser.firstName,
    };
    await createNotification({
      taskId: null,
      teamId,
      recipientUserId: memberUserId,
      actorUserId: userId,
      eventType: "member_removed",
      payload,
    });
  }

  return c.json({ success: true });
});

teamsRouter.post("/teams/:teamId/members/:memberUserId/role", async (c) => {
  const { teamId, memberUserId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const actor = await getTeamMember(teamId, userId);
  try {
    requireAdmin(actor);
  } catch {
    return c.json({ error: "Admin access required" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const newRole = body.role;
  if (!newRole || !["admin", "member"].includes(newRole)) {
    return c.json({ error: "Role must be admin or member" }, 400);
  }

  const target = await getTeamMember(teamId, memberUserId);
  if (!target) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (target.role === TeamRole.OWNER) {
    return c.json({ error: "Cannot change the owner's role" }, 403);
  }

  if (newRole === "member") {
    const admins = await getAdminsForTeam(teamId);
    const remainingAdmins = admins.filter((a) => a.userId !== memberUserId);
    if (remainingAdmins.length === 0) {
      return c.json({ error: "Cannot demote the last admin" }, 403);
    }
  }

  const updated = await updateMemberRole(teamId, memberUserId, newRole);

  await recordTeamEvent({
    teamId,
    actorUserId: userId,
    targetUserId: memberUserId,
    eventType: TeamEventType.MEMBER_ROLE_CHANGED,
    oldValue: target.role,
    newValue: newRole,
  });

  return c.json({ member: updated });
});

teamsRouter.post("/teams/:teamId/invite-code/regenerate", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  try {
    requireAdmin(member);
  } catch {
    return c.json({ error: "Admin access required" }, 403);
  }

  const team = await regenerateInviteCode(teamId);
  return c.json({ inviteCode: team.inviteCode });
});

teamsRouter.get("/teams/:teamId/board", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  if (!member) {
    return c.json({ error: "Access denied" }, 403);
  }

  const columns = await listTeamBoard(teamId);
  return c.json({ columns });
});

teamsRouter.get("/teams/:teamId/board-summary", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  if (!member) {
    return c.json({ error: "Access denied" }, 403);
  }

  const summary = await getBoardSummary(teamId, userId);
  return c.json(summary);
});

teamsRouter.get("/teams/:teamId/admin-contacts", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  const requestId = c.req.query("request_id");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!requestId) {
    return c.json({ error: "request_id is required" }, 400);
  }

  const request = await getJoinRequestById(requestId);
  if (
    !request ||
    request.teamId !== teamId ||
    request.userId !== userId ||
    request.status !== "pending"
  ) {
    return c.json({ error: "Join request not found" }, 404);
  }

  const members = await getTeamMembers(teamId);
  const admins = members
    .filter((member) => isAdminOrOwner(member.role))
    .map((member) => ({
      userId: member.userId,
      telegramUserId: member.user.telegramUserId,
      telegramUsername: member.user.telegramUsername,
      firstName: member.user.firstName,
    }));

  return c.json({ admins });
});

teamsRouter.post("/teams/join", zValidator("json", joinTeamSchema), async (c) => {
  const { inviteCode } = c.req.valid("json");
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const team = await getTeamByInviteCode(inviteCode);
  if (!team) {
    return c.json({ error: "Team not found with that invite code" }, 404);
  }

  const existingMember = await getTeamMember(team.id, userId);
  if (existingMember) {
    return c.json({ error: "You are already a member of this team" }, 409);
  }

  try {
    const request = await createJoinRequest({
      teamId: team.id,
      userId,
    });

    const requester = await getUserById(userId);
    const admins = await getAdminsForTeam(team.id);
    const payload: NotificationPayload = {
      taskTitle: requester
        ? `${requester.firstName}${requester.telegramUsername ? ` (@${requester.telegramUsername})` : ""}`
        : "Someone",
      teamId: team.id,
      teamName: team.name,
    };

    for (const admin of admins) {
      if (admin.userId === userId) continue;
      await createNotification({
        taskId: null,
        teamId: team.id,
        recipientUserId: admin.userId,
        actorUserId: userId,
        eventType: "join_requested",
        payload,
      });
    }

    return c.json({ request }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create join request";
    return c.json({ error: message }, 409);
  }
});

teamsRouter.get("/teams/:teamId/join-requests", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  try {
    requireAdmin(member);
  } catch {
    return c.json({ error: "Admin access required" }, 403);
  }

  const requests = await getJoinRequestsForTeam(teamId);
  return c.json({ requests });
});

teamsRouter.post("/teams/:teamId/join-requests/:requestId/approve", async (c) => {
  const { teamId, requestId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  try {
    requireAdmin(member);
  } catch {
    return c.json({ error: "Admin access required" }, 403);
  }

  const request = await getJoinRequestById(requestId);
  if (!request) {
    return c.json({ error: "Join request not found" }, 404);
  }

  if (request.teamId !== teamId) {
    return c.json({ error: "Join request does not belong to this team" }, 400);
  }

  try {
    const updated = await approveJoinRequest({
      requestId,
      reviewerId: userId,
    });

    await addTeamMember({
      teamId,
      userId: request.userId,
      role: TeamRole.MEMBER,
    });

    await recordTeamEvent({
      teamId,
      actorUserId: userId,
      targetUserId: request.userId,
      eventType: TeamEventType.JOIN_REQUEST_APPROVED,
    });
    await recordTeamEvent({
      teamId,
      actorUserId: userId,
      targetUserId: request.userId,
      eventType: TeamEventType.MEMBER_ADDED,
    });

    const team = await getTeamById(teamId);
    const actorUser = await getUserById(userId);
    const payload: NotificationPayload = {
      taskTitle: team?.name ?? "Unknown team",
      teamId,
      memberName: actorUser?.firstName ?? "An admin",
    };

    await createNotification({
      taskId: null,
      teamId,
      recipientUserId: request.userId,
      actorUserId: userId,
      eventType: "join_request_approved",
      payload,
    });

    const requestUser = await getUserById(request.userId);
    if (!requestUser) {
      return c.json({ error: "Join request user not found" }, 404);
    }
    return c.json({ request: updated, user: requestUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve request";
    return c.json({ error: message }, 400);
  }
});

teamsRouter.post("/teams/:teamId/join-requests/:requestId/reject", async (c) => {
  const { teamId, requestId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  try {
    requireAdmin(member);
  } catch {
    return c.json({ error: "Admin access required" }, 403);
  }

  const request = await getJoinRequestById(requestId);
  if (!request) {
    return c.json({ error: "Join request not found" }, 404);
  }

  if (request.teamId !== teamId) {
    return c.json({ error: "Join request does not belong to this team" }, 400);
  }

  try {
    const updated = await rejectJoinRequest({
      requestId,
      reviewerId: userId,
    });

    await recordTeamEvent({
      teamId,
      actorUserId: userId,
      targetUserId: request.userId,
      eventType: TeamEventType.JOIN_REQUEST_REJECTED,
    });

    const team = await getTeamById(teamId);
    const payload: NotificationPayload = {
      taskTitle: team?.name ?? "Unknown team",
      teamId,
    };

    await createNotification({
      taskId: null,
      teamId,
      recipientUserId: request.userId,
      actorUserId: userId,
      eventType: "join_request_rejected",
      payload,
    });

    const requestUser = await getUserById(request.userId);
    if (!requestUser) {
      return c.json({ error: "Join request user not found" }, 404);
    }
    return c.json({ request: updated, user: requestUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reject request";
    return c.json({ error: message }, 400);
  }
});

teamsRouter.get("/teams/:teamId/activity", async (c) => {
  const { teamId } = c.req.param();
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const member = await getTeamMember(teamId, userId);
  if (!member) {
    return c.json({ error: "Access denied" }, 403);
  }

  const db = getDb();
  const rawEvents = await db
    .select()
    .from(teamEvents)
    .where(eq(teamEvents.teamId, teamId))
    .orderBy(desc(teamEvents.createdAt))
    .limit(50);

  const eventsWithUsers = await Promise.all(
    rawEvents.map(async (event) => {
      const [actor] = await db
        .select({ firstName: usersTable.firstName, telegramUsername: usersTable.telegramUsername })
        .from(usersTable)
        .where(eq(usersTable.id, event.actorUserId))
        .limit(1);
      const target = event.targetUserId
        ? (await db
            .select({ firstName: usersTable.firstName, telegramUsername: usersTable.telegramUsername })
            .from(usersTable)
            .where(eq(usersTable.id, event.targetUserId))
            .limit(1)
          )[0] ?? null
        : null;
      return {
        ...event,
        actor: actor ? { firstName: actor.firstName, telegramUsername: actor.telegramUsername } : null,
        targetUser: target ? { firstName: target.firstName, telegramUsername: target.telegramUsername } : null,
      };
    })
  );

  return c.json({ events: eventsWithUsers });
});
