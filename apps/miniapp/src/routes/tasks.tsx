import { Hono } from "hono";
import { requireMiniAppContext } from "../auth/requireMiniAppUser.js";
import { TaskDetailPage } from "../views/pages/TaskDetailPage.js";
import { NewTaskPage } from "../views/pages/NewTaskPage.js";
import { EditTaskPage } from "../views/pages/EditTaskPage.js";
import { AssignTaskPage } from "../views/pages/AssignTaskPage.js";
import { StatusPage } from "../views/pages/StatusPage.js";
import { CommentPage } from "../views/pages/CommentPage.js";
import { SuccessPage } from "../views/pages/SuccessPage.js";
import {
  getTask,
  getTaskComments,
  getTaskEvents,
  createTask,
  updateTask,
  updateTaskStatus,
  assignTask,
  addTaskComment,
  getTeamMembers,
  type TeamMemberResponse,
} from "../services/apiClient.js";
import type { AppVariables } from "../auth/requireMiniAppUser.js";

const tasksRoutes = new Hono<{ Variables: AppVariables }>();

tasksRoutes.use("*", requireMiniAppContext());

async function fetchMembers(teamId: string | undefined, userId: string): Promise<TeamMemberResponse[]> {
  if (!teamId) return [];
  try {
    return await getTeamMembers(teamId, userId);
  } catch {
    return [];
  }
}

tasksRoutes.get("/tasks/new", async (c) => {
  const apiUser = c.get("apiUser");
  const ctx = c.get("ctx");

  const members = await fetchMembers(ctx.teamId, apiUser.id);

  return c.render(
    <NewTaskPage
      teamId={ctx.teamId ?? ""}
      ctx={c.req.query("ctx")}
      members={members}
      currentUserId={apiUser.id}
    />
  );
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
    assignedToUserId?: string;
    dueAt?: string;
  }>();

  if (!body.title || body.title.trim().length === 0) {
    const members = await fetchMembers(ctx.teamId, apiUser.id);
    return c.render(
      <NewTaskPage
        teamId={ctx.teamId ?? ""}
        ctx={c.req.query("ctx")}
        error="Title is required"
        members={members}
        currentUserId={apiUser.id}
      />
    );
  }

  const task = await createTask({
    title: body.title.trim(),
    description: body.description ?? null,
    priority: body.priority ?? "normal",
    dueAt: body.dueAt || null,
    assignedToUserId: body.assignedToUserId || null,
    teamId: ctx.teamId ?? "",
    createdById: apiUser.id,
  });

  return c.render(
    <SuccessPage
      message="Task created successfully."
      redirectUrl={`/app/tasks/${task.id}?ctx=${c.req.query("ctx") ?? ""}`}
    />
  );
});

tasksRoutes.get("/tasks/:id/edit", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");

  const task = await getTask(id, apiUser.id);
  if (!task) {
    return c.render(<TaskDetailPage task={null} ctx={c.req.query("ctx")} />);
  }

  return c.render(<EditTaskPage task={task} ctx={c.req.query("ctx")} />);
});

tasksRoutes.post("/tasks/:id/edit", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");

  const body = await c.req.parseBody<{
    title: string;
    description?: string;
    priority?: string;
    dueAt?: string;
  }>();

  const task = await getTask(id, apiUser.id);
  if (!task) {
    return c.render(<TaskDetailPage task={null} ctx={c.req.query("ctx")} />);
  }

  if (!body.title || body.title.trim().length === 0) {
    return c.render(<EditTaskPage task={task} ctx={c.req.query("ctx")} error="Title is required" />);
  }

  await updateTask(
    id,
    {
      title: body.title.trim(),
      description: body.description ?? null,
      priority: body.priority ?? "normal",
      dueAt: body.dueAt || null,
    },
    apiUser.id
  );

  return c.render(
    <SuccessPage
      message="Task updated successfully."
      redirectUrl={`/app/tasks/${id}?ctx=${c.req.query("ctx") ?? ""}`}
    />
  );
});

tasksRoutes.get("/tasks/:id/assign", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");
  const ctx = c.get("ctx");

  const task = await getTask(id, apiUser.id);
  if (!task) {
    return c.render(<TaskDetailPage task={null} ctx={c.req.query("ctx")} />);
  }

  const members = await fetchMembers(task.teamId, apiUser.id);

  return c.render(
    <AssignTaskPage
      task={task}
      members={members}
      currentUserId={apiUser.id}
      ctx={c.req.query("ctx")}
    />
  );
});

tasksRoutes.post("/tasks/:id/assign", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");

  const body = await c.req.parseBody<{ assignedToUserId: string }>();

  const task = await getTask(id, apiUser.id);
  if (!task) {
    return c.render(<TaskDetailPage task={null} ctx={c.req.query("ctx")} />);
  }

  const members = await fetchMembers(task.teamId, apiUser.id);

  try {
    if (body.assignedToUserId) {
      await assignTask(id, body.assignedToUserId, apiUser.id);
    } else {
      await updateTask(id, { assignedToUserId: null }, apiUser.id);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to assign task";
    return c.render(
      <AssignTaskPage
        task={task}
        members={members}
        currentUserId={apiUser.id}
        ctx={c.req.query("ctx")}
        error={errorMsg}
      />
    );
  }

  return c.render(
    <SuccessPage
      message="Task assigned successfully."
      redirectUrl={`/app/tasks/${id}?ctx=${c.req.query("ctx") ?? ""}`}
    />
  );
});

tasksRoutes.get("/tasks/:id/status", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");

  const task = await getTask(id, apiUser.id);
  if (!task) {
    return c.render(<TaskDetailPage task={null} ctx={c.req.query("ctx")} />);
  }

  return c.render(<StatusPage task={task} ctx={c.req.query("ctx")} />);
});

tasksRoutes.post("/tasks/:id/status", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");
  const body = await c.req.parseBody<{ status: string }>();

  if (body.status) {
    await updateTaskStatus(id, body.status, apiUser.id);
  }

  return c.render(
    <SuccessPage
      message="Status updated successfully."
      redirectUrl={`/app/tasks/${id}?ctx=${c.req.query("ctx") ?? ""}`}
    />
  );
});

tasksRoutes.get("/tasks/:id/comment", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");

  const task = await getTask(id, apiUser.id);
  if (!task) {
    return c.render(<TaskDetailPage task={null} ctx={c.req.query("ctx")} />);
  }

  return c.render(<CommentPage task={task} ctx={c.req.query("ctx")} />);
});

tasksRoutes.post("/tasks/:id/comment", async (c) => {
  const { id } = c.req.param();
  const apiUser = c.get("apiUser");

  const body = await c.req.parseBody<{ body: string }>();

  const task = await getTask(id, apiUser.id);
  if (!task) {
    return c.render(<TaskDetailPage task={null} ctx={c.req.query("ctx")} />);
  }

  if (!body.body || body.body.trim().length === 0) {
    return c.render(<CommentPage task={task} ctx={c.req.query("ctx")} error="Comment cannot be empty" />);
  }

  await addTaskComment(id, body.body.trim(), apiUser.id);

  return c.render(
    <SuccessPage
      message="Comment added successfully."
      redirectUrl={`/app/tasks/${id}?ctx=${c.req.query("ctx") ?? ""}`}
    />
  );
});

export { tasksRoutes };
