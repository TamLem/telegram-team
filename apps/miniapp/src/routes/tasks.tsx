import { Hono } from "hono";
import { requireMiniAppUser } from "../auth/requireMiniAppUser.js";
import { MyTasksPage } from "../views/pages/MyTasksPage.js";
import { TaskDetailPage } from "../views/pages/TaskDetailPage.js";
import { NewTaskPage } from "../views/pages/NewTaskPage.js";
import {
  getMyTasks,
  getTask,
  createTask,
  updateTaskStatus,
} from "../services/apiClient.js";

const tasksRoutes = new Hono<{ Variables: { telegramUser: any; apiUser: { id: string } } }>();

tasksRoutes.use("*", requireMiniAppUser());

tasksRoutes.get("/tasks/mine", async (c) => {
  const apiUser = c.get("apiUser");
  const tgUser = c.get("telegramUser");

  const tasks = await getMyTasks(apiUser.id);

  return c.render(
    <MyTasksPage tasks={tasks} username={tgUser.first_name} />
  );
});

tasksRoutes.get("/tasks/:id", async (c) => {
  const { id } = c.req.param();
  const task = await getTask(id);

  return c.render(<TaskDetailPage task={task} />);
});

tasksRoutes.get("/new-task", (c) => {
  return c.render(<NewTaskPage />);
});

tasksRoutes.post("/tasks", async (c) => {
  const apiUser = c.get("apiUser");
  const body = await c.req.parseBody<{
    title: string;
    description?: string;
    priority?: string;
  }>();

  if (!body.title || body.title.trim().length === 0) {
    return c.render(<NewTaskPage />);
  }

  const task = await createTask({
    title: body.title.trim(),
    description: body.description ?? null,
    priority: body.priority ?? "medium",
    createdById: apiUser.id,
  });

  return c.redirect(`/app/tasks/${task.id}`);
});

tasksRoutes.post("/tasks/:id/status", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.parseBody<{ status: string }>();

  if (body.status) {
    await updateTaskStatus(id, body.status);
  }

  return c.redirect(`/app/tasks/${id}`);
});

export { tasksRoutes };
