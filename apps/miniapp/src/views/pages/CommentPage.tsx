import type { FC } from "hono/jsx";
import { Button } from "../components/Button.js";
import { MiniAppNav } from "../components/MiniAppNav.js";
import type { TaskResponse } from "../../services/apiClient.js";

export const CommentPage: FC<{
  task: TaskResponse;
  ctx?: string;
  error?: string;
}> = ({ task, ctx, error }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={task.teamId} />

      <a href={`/app/tasks/${task.id}${ctxQuery}`} class="back-link">
        &larr; Back to Task
      </a>

      <div class="header">
        <h1>Add Comment</h1>
      </div>

      <div class="card">
        <p style="font-size: 14px; color: var(--tg-theme-hint-color, #64748b); margin-bottom: 16px;">
          Task: <b>{task.title}</b>
        </p>

        <form method="post" action={`/app/tasks/${task.id}/comment${ctxQuery}`}>
          <input type="hidden" name="ctx" value={ctx ?? ""} />
          {error && (
            <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-bottom: 12px; font-size: 14px;">
              {error}
            </p>
          )}
          <div class="form-group">
            <label class="form-label" for="body">Comment</label>
            <textarea
              id="body"
              name="body"
              class="form-input form-textarea"
              required
              placeholder="Write a comment..."
            />
          </div>

          <Button type="submit" block>Post Comment</Button>
        </form>
      </div>
    </div>
  );
};
