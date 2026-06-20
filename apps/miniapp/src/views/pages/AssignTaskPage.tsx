import type { FC } from "hono/jsx";
import { Button } from "../components/Button.js";
import { MiniAppNav } from "../components/MiniAppNav.js";
import type { TaskResponse, TeamMemberResponse } from "../../services/apiClient.js";

export const AssignTaskPage: FC<{
  task: TaskResponse;
  members: TeamMemberResponse[];
  currentUserId?: string;
  ctx?: string;
  error?: string;
}> = ({ task, members, currentUserId, ctx, error }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={task.teamId} />

      <a href={`/app/tasks/${task.id}${ctxQuery}`} class="back-link">
        &larr; Back to Task
      </a>

      <div class="header">
        <h1>Assign Task</h1>
      </div>

      <div class="card">
        <p style="font-size: 14px; color: var(--tg-theme-hint-color, #64748b); margin-bottom: 16px;">
          Task: <b>{task.title}</b>
        </p>

        <form method="post" action={`/app/tasks/${task.id}/assign${ctxQuery}`}>
          <input type="hidden" name="ctx" value={ctx ?? ""} />
          {error && (
            <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-bottom: 12px; font-size: 14px;">
              {error}
            </p>
          )}
          <div class="form-group">
            <label class="form-label" for="assignee">Assign to</label>
            <select id="assignee" name="assignedToUserId" class="form-select">
              <option value="" selected={!task.assignedToUserId}>Unassigned</option>
              {currentUserId && (
                <option value={currentUserId} selected={task.assignedToUserId === currentUserId}>
                  Me
                </option>
              )}
              {members
                .filter((m) => m.userId !== currentUserId)
                .map((m) => (
                  <option value={m.userId} selected={task.assignedToUserId === m.userId}>
                    {m.user.firstName}{m.user.telegramUsername ? ` (@${m.user.telegramUsername})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <Button type="submit" block>Assign</Button>
        </form>
      </div>
    </div>
  );
};
