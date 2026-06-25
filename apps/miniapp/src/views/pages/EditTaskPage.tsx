import type { FC } from "hono/jsx";
import { Button } from "../components/Button.js";
import { MiniAppNav } from "../components/MiniAppNav.js";
import type { TaskResponse } from "../../services/apiClient.js";

export const EditTaskPage: FC<{
  task: TaskResponse;
  ctx?: string;
  error?: string;
}> = ({ task, ctx, error }) => {
  const ctxQuery = "";
  const dueValue = task.dueAt
    ? task.dueAt.slice(0, 16)
    : "";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={task.teamId} />

      <a href={`/app/tasks/${task.id}${ctxQuery}`} class="back-link">
        &larr; Back to Task
      </a>

      <div class="header">
        <h1>Edit Task</h1>
      </div>

      <div class="card">
        <form method="post" action={`/app/tasks/${task.id}/edit${ctxQuery}`}>
          <input type="hidden" name="ctx" value={ctx ?? ""} />
          {error && (
            <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-bottom: 12px; font-size: 14px;">
              {error}
            </p>
          )}
          <div class="form-group">
            <label class="form-label" for="title">Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              class="form-input"
              required
              value={task.title}
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="description">Description</label>
            <textarea
              id="description"
              name="description"
              class="form-input form-textarea"
            >
              {task.description ?? ""}
            </textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="priority">Priority</label>
            <select id="priority" name="priority" class="form-select">
              <option value="normal" selected={task.priority === "normal"}>Normal</option>
              <option value="low" selected={task.priority === "low"}>Low</option>
              <option value="high" selected={task.priority === "high"}>High</option>
              <option value="urgent" selected={task.priority === "urgent"}>Urgent</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="dueAt">Due</label>
            <input
              id="dueAt"
              name="dueAt"
              type="datetime-local"
              class="form-input"
              value={dueValue}
            />
          </div>

          <Button type="submit" block>Save Changes</Button>
        </form>
      </div>
    </div>
  );
};
