import type { FC } from "hono/jsx";
import { Button } from "../components/Button.js";
import { MiniAppNav } from "../components/MiniAppNav.js";
import type { TeamMemberResponse } from "../../services/apiClient.js";

export const NewTaskPage: FC<{
  teamId: string;
  ctx?: string;
  error?: string;
  members?: TeamMemberResponse[];
  currentUserId?: string;
}> = ({ teamId, ctx, error, members = [], currentUserId }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={teamId} current="new" />

      <a href={`/app/board/${teamId}${ctxQuery}`} class="back-link">
        &larr; Back
      </a>

      <div class="header">
        <h1>New Task</h1>
      </div>

      <div class="card">
        <form method="post" action={`/app/tasks${ctxQuery}`}>
          <input type="hidden" name="ctx" value={ctx ?? ""} />
          {error && (
            <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-bottom: 12px; font-size: 14px;">
              {error}
            </p>
          )}
          <div class="form-group">
            <label class="form-label" for="title">
              Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              class="form-input"
              required
              placeholder="Enter task title..."
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              class="form-input form-textarea"
              placeholder="Enter task description..."
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="assignee">
              Assignee
            </label>
            <select id="assignee" name="assignedToUserId" class="form-select">
              <option value="">Unassigned</option>
              {currentUserId && (
                <option value={currentUserId}>Me</option>
              )}
              {members
                .filter((m) => m.userId !== currentUserId)
                .map((m) => (
                  <option value={m.userId}>
                    {m.user.firstName}{m.user.telegramUsername ? ` (@${m.user.telegramUsername})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="priority">
              Priority
            </label>
            <select id="priority" name="priority" class="form-select">
              <option value="normal" selected>Normal</option>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="dueAt">
              Due Date
            </label>
            <input
              id="dueAt"
              name="dueAt"
              type="date"
              class="form-input"
            />
          </div>

          <Button type="submit" block>
            Create Task
          </Button>
        </form>
      </div>
    </div>
  );
};
