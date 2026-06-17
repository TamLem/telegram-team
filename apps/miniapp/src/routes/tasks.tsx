import { Hono } from "hono";
import { requireMiniAppUser } from "../auth/requireMiniAppUser.js";
import { MyTasksPage } from "../views/pages/MyTasksPage.js";
import { TaskDetailPage } from "../views/pages/TaskDetailPage.js";
import { NewTaskPage } from "../views/pages/NewTaskPage.js";
import {
  getMyTasks,
  getTask,
  getTaskComments,
  getTaskEvents,
  createTask,
  updateTaskStatus,
} from "../services/apiClient.js";

const tasksRoutes = new Hono<{
  Variables: {
    telegramUser: any;
    apiUser: { id: string };
    hasTeam: boolean;
    teams: any[];
  };
}>();

tasksRoutes.use("*", requireMiniAppUser());

tasksRoutes.get("/tasks/mine", async (c) => {
  const apiUser = c.get("apiUser");
  const hasTeam = c.get("hasTeam");
  const tgUser = c.get("telegramUser");

  if (!hasTeam) {
    return c.redirect("/app/onboarding");
  }

  const tasks = await getMyTasks(apiUser.id);

  return c.render(
    <MyTasksPage tasks={tasks} username={tgUser.first_name} />
  );
});

tasksRoutes.get("/tasks/:id", async (c) => {
  const { id } = c.req.param();
  const task = await getTask(id);

  let comments: any[] = [];
  let events: any[] = [];

  if (task) {
    try {
      comments = await getTaskComments(task.id);
    } catch {}
    try {
      events = await getTaskEvents(task.id);
    } catch {}
  }

  return c.render(
    <TaskDetailPage task={task} comments={comments} events={events} />
  );
});

tasksRoutes.get("/new-task", async (c) => {
  const hasTeam = c.get("hasTeam");
  if (!hasTeam) {
    return c.redirect("/app/onboarding");
  }
  return c.render(<NewTaskPage />);
});

tasksRoutes.post("/tasks", async (c) => {
  const apiUser = c.get("apiUser");
  const hasTeam = c.get("hasTeam");
  const teams = c.get("teams");

  if (!hasTeam || !teams || teams.length === 0) {
    return c.redirect("/app/onboarding");
  }

  const body = await c.req.parseBody<{
    title: string;
    description?: string;
    priority?: string;
    dueAt?: string;
  }>();

  if (!body.title || body.title.trim().length === 0) {
    return c.render(<NewTaskPage />);
  }

  const task = await createTask({
    title: body.title.trim(),
    description: body.description ?? null,
    priority: body.priority ?? "normal",
    dueAt: body.dueAt || null,
    teamId: teams[0].id,
    createdById: apiUser.id,
  });

  return c.redirect(`/app/tasks/${task.id}`);
});

tasksRoutes.post("/tasks/:id/status", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");
  const body = await c.req.parseBody<{ status: string }>();

  if (body.status) {
    await updateTaskStatus(id, body.status, apiUser.id);
  }

  return c.redirect(`/app/tasks/${id}`);
});

export { tasksRoutes };
