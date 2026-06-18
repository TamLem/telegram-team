import { Hono } from "hono";
import { requireMiniAppContext } from "../auth/requireMiniAppUser.js";
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
import type { AppVariables } from "../auth/requireMiniAppUser.js";

const tasksRoutes = new Hono<{ Variables: AppVariables }>();

tasksRoutes.use("*", requireMiniAppContext());

tasksRoutes.get("/tasks/mine", async (c) => {
  const apiUser = c.get("apiUser");
  const ctx = c.get("ctx");
  const tgUser = c.get("telegramUser");

  const tasks = await getMyTasks(apiUser.id, ctx.teamId);

  return c.render(<MyTasksPage tasks={tasks} username={tgUser.first_name} ctx={c.req.query("ctx")} />);
});

tasksRoutes.get("/tasks/new", async (c) => {
  const ctx = c.get("ctx");
  return c.render(<NewTaskPage teamId={ctx.teamId} ctx={c.req.query("ctx")} />);
});

tasksRoutes.get("/tasks/:id", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");

  const task = await getTask(id, apiUser.id);

  let comments: any[] = [];
  let events: any[] = [];

  if (task) {
    try {
      comments = await getTaskComments(task.id, apiUser.id);
    } catch {}
    try {
      events = await getTaskEvents(task.id, apiUser.id);
    } catch {}
  }

  return c.render(
    <TaskDetailPage task={task} comments={comments} events={events} ctx={c.req.query("ctx")} />
  );
});

tasksRoutes.post("/tasks", async (c) => {
  const apiUser = c.get("apiUser");
  const ctx = c.get("ctx");

  const body = await c.req.parseBody<{
    title: string;
    description?: string;
    priority?: string;
    dueAt?: string;
  }>();

  if (!body.title || body.title.trim().length === 0) {
    return c.render(<NewTaskPage teamId={ctx.teamId} ctx={c.req.query("ctx")} error="Title is required" />);
  }

  const task = await createTask({
    title: body.title.trim(),
    description: body.description ?? null,
    priority: body.priority ?? "normal",
    dueAt: body.dueAt || null,
    teamId: ctx.teamId,
    createdById: apiUser.id,
  });

  return c.redirect(`/app/tasks/${task.id}?ctx=${c.req.query("ctx")}`);
});

tasksRoutes.post("/tasks/:id/status", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");
  const body = await c.req.parseBody<{ status: string }>();

  if (body.status) {
    await updateTaskStatus(id, body.status, apiUser.id);
  }

  return c.redirect(`/app/tasks/${id}?ctx=${c.req.query("ctx")}`);
});

export { tasksRoutes };
