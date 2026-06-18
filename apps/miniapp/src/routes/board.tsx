import { Hono } from "hono";
import { requireMiniAppContext } from "../auth/requireMiniAppUser.js";
import { BoardPage } from "../views/pages/BoardPage.js";
import { getBoard } from "../services/apiClient.js";
import type { AppVariables } from "../auth/requireMiniAppUser.js";

const boardRoutes = new Hono<{ Variables: AppVariables }>();

boardRoutes.use("*", requireMiniAppContext());

boardRoutes.get("/board/:teamId", async (c) => {
  const { teamId } = c.req.param();
  const apiUser = c.get("apiUser");
  const filterStatus = c.req.query("status") ?? null;

  const { columns } = await getBoard(teamId, apiUser.id);

  return c.render(
    <BoardPage
      teamId={teamId}
      columns={columns}
      filterStatus={filterStatus}
      ctx={c.req.query("ctx")}
    />
  );
});

export { boardRoutes };
