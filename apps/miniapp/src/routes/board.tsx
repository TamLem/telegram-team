import { Hono } from "hono";
import { requireMiniAppUser, setActiveTeam } from "../auth/requireMiniAppUser.js";
import { BoardPage } from "../views/pages/BoardPage.js";
import {
  getBoard,
  getTeamMembers,
  setPreferredTeam,
} from "../services/apiClient.js";
import type { AppVariables } from "../auth/requireMiniAppUser.js";
import type { TeamMemberResponse } from "../services/apiClient.js";

const boardRoutes = new Hono<{ Variables: AppVariables }>();

boardRoutes.use("*", requireMiniAppUser());

boardRoutes.get("/board/:teamId", async (c) => {
  const { teamId } = c.req.param();
  const apiUser = c.get("apiUser");
  const teams = c.get("teams");
  const filterStatus = c.req.query("status") ?? null;
  const filterAssignee = c.req.query("assignee") ?? null;
  const filterPriority = c.req.query("priority") ?? null;

  const memberOf = teams.find((t) => t.id === teamId);
  if (!memberOf) {
    return c.redirect("/app/teams");
  }

  const { columns } = await getBoard(teamId, apiUser.id);
  setActiveTeam(c, teamId);
  try {
    await setPreferredTeam(apiUser.id, teamId);
  } catch {
    // best-effort
  }

  let members: TeamMemberResponse[] = [];
  try {
    members = await getTeamMembers(teamId, apiUser.id);
  } catch {}

  return c.render(
    <BoardPage
      teamId={teamId}
      teamName={memberOf.name}
      teams={teams}
      columns={columns}
      filterStatus={filterStatus}
      filterAssignee={filterAssignee}
      filterPriority={filterPriority}
      members={members}
      currentUserId={apiUser.id}
    />
  );
});

export { boardRoutes };
