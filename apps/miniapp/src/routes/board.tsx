import { Hono } from "hono";
import { requireMiniAppUser } from "../auth/requireMiniAppUser.js";
import { BoardPage } from "../views/pages/BoardPage.js";
import { getBoardTasks } from "../services/apiClient.js";

const boardRoutes = new Hono<{ Variables: { telegramUser: any; apiUser: { id: string } } }>();

boardRoutes.use("*", requireMiniAppUser());

boardRoutes.get("/board/:teamId", async (c) => {
  const { teamId } = c.req.param();
  const tasks = await getBoardTasks(teamId);

  return c.render(<BoardPage teamId={teamId} tasks={tasks} />);
});

export { boardRoutes };
