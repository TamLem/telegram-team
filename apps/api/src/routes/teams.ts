import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createTeamSchema, joinTeamSchema } from "@telegram-team/shared";
import { TeamRole, MembershipStatus } from "@telegram-team/shared";
import { createTeam, getTeamById, getTeamByInviteCode } from "../services/teams.service.js";
import { listTeamBoard } from "../services/task.service.js";
import { addTeamMember, getTeamMembers, getTeamMember } from "../services/membership.service.js";
import {
  createJoinRequest,
  getJoinRequestById,
  getJoinRequestsForTeam,
  approveJoinRequest,
  rejectJoinRequest,
} from "../services/joinRequests.service.js";
import { requireAdmin, isAdminOrOwner } from "../services/authorization.service.js";
import { getUserById } from "../services/users.service.js";

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
