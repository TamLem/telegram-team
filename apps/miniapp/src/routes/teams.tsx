import { Hono } from "hono";
import { requireMiniAppUser } from "../auth/requireMiniAppUser.js";
import { TeamPage } from "../views/pages/TeamPage.js";
import { MembersPage } from "../views/pages/MembersPage.js";
import { InvitePage } from "../views/pages/InvitePage.js";
import { JoinRequestsPage } from "../views/pages/JoinRequestsPage.js";
import { SettingsPage } from "../views/pages/SettingsPage.js";
import { TeamActivityPage } from "../views/pages/TeamActivityPage.js";
import {
  getTeam,
  updateTeam,
  regenerateInviteCode,
  getTeamMembers,
  removeMember,
  updateMemberRole,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getTeamActivity,
} from "../services/apiClient.js";
import type { AppVariables } from "../auth/requireMiniAppUser.js";

const teamRoutes = new Hono<{ Variables: AppVariables }>();

teamRoutes.use("*", requireMiniAppUser());

async function resolveTeamId(c: any): Promise<string | null> {
  const ctx = c.get("ctx");
  if (ctx?.teamId) return ctx.teamId;
  const activeTeamId = c.get("activeTeamId");
  if (activeTeamId) return activeTeamId;
  const teams = c.get("teams");
  if (teams && teams.length > 0) return teams[0].id;
  return null;
}

async function getUserRole(c: any, teamId: string): Promise<string> {
  const teams = c.get("teams") as Array<{ id: string; name: string; role: string }> | undefined;
  const member = teams?.find((t) => t.id === teamId);
  return member?.role ?? "member";
}

teamRoutes.get("/team", async (c) => {
  const teams = c.get("teams") ?? [];
  const teamId = await resolveTeamId(c);
  if (!teamId) {
    return c.render(<TeamPage
      team={{ id: "", name: "No Team", inviteCode: "" }}
      userRole="member"
      memberCount={0}
      pendingRequestCount={0}
      teams={teams}
      ctx={c.req.query("ctx")}
      error="You are not a member of any team. Create or join one below."
    />);
  }

  const apiUser = c.get("apiUser");
  const userRole = await getUserRole(c, teamId);

  try {
    const data = await getTeam(teamId, apiUser.id);
    return c.render(<TeamPage
      team={data.team}
      userRole={userRole}
      memberCount={data.memberCount}
      pendingRequestCount={data.pendingRequestCount}
      teams={teams}
      ctx={c.req.query("ctx")}
    />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load team";
    return c.render(<TeamPage
      team={{ id: teamId, name: "Team", inviteCode: "" }}
      userRole={userRole}
      memberCount={0}
      pendingRequestCount={0}
      teams={teams}
      ctx={c.req.query("ctx")}
      error={errorMsg}
    />);
  }
});

teamRoutes.get("/team/members", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) {
    return c.render(<MembersPage
      teamId=""
      members={[]}
      userRole="member"
      currentUserId=""
      ctx={c.req.query("ctx")}
      error="No team found."
    />);
  }

  const apiUser = c.get("apiUser");
  const userRole = await getUserRole(c, teamId);

  try {
    const members = await getTeamMembers(teamId, apiUser.id);
    return c.render(<MembersPage
      teamId={teamId}
      members={members}
      userRole={userRole}
      currentUserId={apiUser.id}
      ctx={c.req.query("ctx")}
    />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load members";
    return c.render(<MembersPage
      teamId={teamId}
      members={[]}
      userRole={userRole}
      currentUserId={apiUser.id}
      ctx={c.req.query("ctx")}
      error={errorMsg}
    />);
  }
});

teamRoutes.post("/team/members", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) return c.json({ error: "No team found" }, 400);

  const apiUser = c.get("apiUser");
  const userRole = await getUserRole(c, teamId);
  const isAdmin = userRole === "owner" || userRole === "admin";
  if (!isAdmin) {
    return c.render(<MembersPage
      teamId={teamId}
      members={[]}
      userRole={userRole}
      currentUserId={apiUser.id}
      ctx={c.req.query("ctx")}
      error="Admin access required"
    />);
  }

  const body = await c.req.parseBody<{ action: string; memberUserId: string }>();
  const members = await getTeamMembers(teamId, apiUser.id);
  const ctxQuery = c.req.query("ctx");
  const props = { teamId, members, userRole, currentUserId: apiUser.id, ctx: ctxQuery };

  try {
    switch (body.action) {
      case "promote":
        await updateMemberRole(teamId, body.memberUserId, "admin", apiUser.id);
        return c.render(<MembersPage {...props} success="Member promoted to admin" />);
      case "demote":
        await updateMemberRole(teamId, body.memberUserId, "member", apiUser.id);
        return c.render(<MembersPage {...props} success="Member demoted to member" />);
      case "remove":
        await removeMember(teamId, body.memberUserId, apiUser.id);
        return c.render(<MembersPage {...props} success="Member removed" />);
      default:
        return c.render(<MembersPage {...props} error="Invalid action" />);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Action failed";
    return c.render(<MembersPage {...props} error={errorMsg} />);
  }
});

teamRoutes.get("/team/invite", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) {
    return c.render(<InvitePage
      teamId=""
      inviteCode=""
      userRole="member"
      ctx={c.req.query("ctx")}
      error="No team found."
    />);
  }

  const apiUser = c.get("apiUser");

  try {
    const data = await getTeam(teamId, apiUser.id);
    const userRole = await getUserRole(c, teamId);
    const isAdmin = userRole === "owner" || userRole === "admin";

    if (!isAdmin) {
      return c.render(<InvitePage
        teamId={teamId}
        inviteCode={data.team.inviteCode}
        userRole={userRole}
        ctx={c.req.query("ctx")}
        error="Only admins can manage team invites."
      />);
    }

    return c.render(<InvitePage
      teamId={teamId}
      inviteCode={data.team.inviteCode}
      userRole={userRole}
      ctx={c.req.query("ctx")}
    />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load invite";
    return c.render(<InvitePage
      teamId={teamId}
      inviteCode=""
      userRole="member"
      ctx={c.req.query("ctx")}
      error={errorMsg}
    />);
  }
});

teamRoutes.post("/team/invite", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) return c.json({ error: "No team found" }, 400);

  const apiUser = c.get("apiUser");
  const userRole = await getUserRole(c, teamId);
  const isAdmin = userRole === "owner" || userRole === "admin";

  if (!isAdmin) {
    return c.render(<InvitePage
      teamId={teamId}
      inviteCode=""
      userRole={userRole}
      ctx={c.req.query("ctx")}
      error="Admin access required"
    />);
  }

  const body = await c.req.parseBody<{ action: string }>();

  try {
    if (body.action === "regenerate") {
      const newCode = await regenerateInviteCode(teamId, apiUser.id);
      return c.render(<InvitePage
        teamId={teamId}
        inviteCode={newCode}
        userRole={userRole}
        ctx={c.req.query("ctx")}
        success="Invite code regenerated"
      />);
    }
    return c.render(<InvitePage
      teamId={teamId}
      inviteCode=""
      userRole={userRole}
      ctx={c.req.query("ctx")}
      error="Invalid action"
    />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to regenerate code";
    return c.render(<InvitePage
      teamId={teamId}
      inviteCode=""
      userRole={userRole}
      ctx={c.req.query("ctx")}
      error={errorMsg}
    />);
  }
});

teamRoutes.get("/team/join-requests", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) {
    return c.render(<JoinRequestsPage teamId="" requests={[]} ctx={c.req.query("ctx")} error="No team found." />);
  }

  const apiUser = c.get("apiUser");
  const userRole = await getUserRole(c, teamId);
  const isAdmin = userRole === "owner" || userRole === "admin";

  if (!isAdmin) {
    return c.render(<JoinRequestsPage teamId={teamId} requests={[]} ctx={c.req.query("ctx")} error="Admin access required" />);
  }

  try {
    const requests = await getJoinRequests(teamId, apiUser.id);
    return c.render(<JoinRequestsPage teamId={teamId} requests={requests} ctx={c.req.query("ctx")} />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load requests";
    return c.render(<JoinRequestsPage teamId={teamId} requests={[]} ctx={c.req.query("ctx")} error={errorMsg} />);
  }
});

teamRoutes.post("/team/join-requests", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) return c.json({ error: "No team found" }, 400);

  const apiUser = c.get("apiUser");
  const userRole = await getUserRole(c, teamId);
  const isAdmin = userRole === "owner" || userRole === "admin";

  if (!isAdmin) {
    return c.render(<JoinRequestsPage teamId={teamId} requests={[]} ctx={c.req.query("ctx")} error="Admin access required" />);
  }

  const body = await c.req.parseBody<{ action: string; requestId: string }>();

  try {
    if (body.action === "approve") {
      await approveJoinRequest(teamId, body.requestId, apiUser.id);
    } else if (body.action === "reject") {
      await rejectJoinRequest(teamId, body.requestId, apiUser.id);
    } else {
      const requests = await getJoinRequests(teamId, apiUser.id);
      return c.render(<JoinRequestsPage teamId={teamId} requests={requests} ctx={c.req.query("ctx")} error="Invalid action" />);
    }
    const requests = await getJoinRequests(teamId, apiUser.id);
    return c.render(<JoinRequestsPage
      teamId={teamId}
      requests={requests}
      ctx={c.req.query("ctx")}
      success={body.action === "approve" ? "Request approved" : "Request rejected"}
    />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Action failed";
    const requests = await getJoinRequests(teamId, apiUser.id).catch(() => []);
    return c.render(<JoinRequestsPage teamId={teamId} requests={requests} ctx={c.req.query("ctx")} error={errorMsg} />);
  }
});

teamRoutes.get("/team/settings", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) {
    return c.render(<SettingsPage team={{ id: "", name: "" }} ctx={c.req.query("ctx")} error="No team found." />);
  }

  const apiUser = c.get("apiUser");
  const userRole = await getUserRole(c, teamId);
  const isAdmin = userRole === "owner" || userRole === "admin";

  if (!isAdmin) {
    return c.render(<SettingsPage team={{ id: teamId, name: "" }} ctx={c.req.query("ctx")} error="Admin access required" />);
  }

  try {
    const data = await getTeam(teamId, apiUser.id);
    return c.render(<SettingsPage team={data.team} ctx={c.req.query("ctx")} />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load settings";
    return c.render(<SettingsPage team={{ id: teamId, name: "" }} ctx={c.req.query("ctx")} error={errorMsg} />);
  }
});

teamRoutes.post("/team/settings", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) return c.json({ error: "No team found" }, 400);

  const apiUser = c.get("apiUser");
  const userRole = await getUserRole(c, teamId);
  const isAdmin = userRole === "owner" || userRole === "admin";

  if (!isAdmin) {
    return c.render(<SettingsPage team={{ id: teamId, name: "" }} ctx={c.req.query("ctx")} error="Admin access required" />);
  }

  const body = await c.req.parseBody<{ action: string; name: string }>();

  try {
    if (body.action === "updateName") {
      if (!body.name || body.name.trim().length === 0) {
        return c.render(<SettingsPage team={{ id: teamId, name: body.name ?? "" }} ctx={c.req.query("ctx")} error="Team name is required" />);
      }
      const updated = await updateTeam(teamId, body.name.trim(), apiUser.id);
      return c.render(<SettingsPage team={updated} ctx={c.req.query("ctx")} success="Team name updated" />);
    }
    return c.render(<SettingsPage team={{ id: teamId, name: "" }} ctx={c.req.query("ctx")} error="Invalid action" />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update";
    return c.render(<SettingsPage team={{ id: teamId, name: body.name ?? "" }} ctx={c.req.query("ctx")} error={errorMsg} />);
  }
});

teamRoutes.get("/team/activity", async (c) => {
  const teamId = await resolveTeamId(c);
  if (!teamId) {
    return c.render(<TeamActivityPage teamId="" events={[]} ctx={c.req.query("ctx")} error="No team found." />);
  }

  const apiUser = c.get("apiUser");

  try {
    const events = await getTeamActivity(teamId, apiUser.id);
    return c.render(<TeamActivityPage teamId={teamId} events={events} ctx={c.req.query("ctx")} />);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load activity";
    return c.render(<TeamActivityPage teamId={teamId} events={[]} ctx={c.req.query("ctx")} error={errorMsg} />);
  }
});

export { teamRoutes };
