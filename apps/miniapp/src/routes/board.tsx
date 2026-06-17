import { Hono } from "hono";
import { requireMiniAppUser } from "../auth/requireMiniAppUser.js";
import { BoardPage } from "../views/pages/BoardPage.js";
import { getBoardTasks } from "../services/apiClient.js";

const boardRoutes = new Hono<{
  Variables: {
    telegramUser: any;
    apiUser: { id: string };
    hasTeam: boolean;
    teams: any[];
  };
}>();

boardRoutes.use("*", requireMiniAppUser());

boardRoutes.get("/board/:teamId", async (c) => {
  const { teamId } = c.req.param();
  const apiUser = c.get("apiUser");
  const hasTeam = c.get("hasTeam");

  if (!hasTeam) {
    return c.redirect("/app/onboarding");
  }

  const tasks = await getBoardTasks(teamId, apiUser.id);

  return c.render(<BoardPage teamId={teamId} tasks={tasks} />);
});

export { boardRoutes };
