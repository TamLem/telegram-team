import { Hono } from "hono";
import { requireMiniAppContext } from "../auth/requireMiniAppUser.js";
import { BoardPage } from "../views/pages/BoardPage.js";
import { getBoard, getTeamMembers } from "../services/apiClient.js";
import type { AppVariables } from "../auth/requireMiniAppUser.js";
import type { TeamMemberResponse } from "../services/apiClient.js";

const boardRoutes = new Hono<{ Variables: AppVariables }>();

boardRoutes.use("*", requireMiniAppContext());

boardRoutes.get("/board/:teamId", async (c) => {
  const { teamId } = c.req.param();
  const apiUser = c.get("apiUser");
  const filterStatus = c.req.query("status") ?? null;
  const filterAssignee = c.req.query("assignee") ?? null;

  const { columns } = await getBoard(teamId, apiUser.id);

  let members: TeamMemberResponse[] = [];
  try {
    members = await getTeamMembers(teamId, apiUser.id);
  } catch {}

  return c.render(
    <BoardPage
      teamId={teamId}
      columns={columns}
      filterStatus={filterStatus}
      filterAssignee={filterAssignee}
      members={members}
      currentUserId={apiUser.id}
      ctx={c.req.query("ctx")}
    />
  );
});

export { boardRoutes };
