import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  doing: "Doing",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const NEXT_STATUS: Record<string, string | null> = {
  todo: "doing",
  doing: "done",
  blocked: "done",
  done: null,
  cancelled: null,
};

export const TaskCard: FC<{
  task: TaskResponse;
  ctx?: string;
  teamId?: string;
  showActions?: boolean;
}> = ({ task, ctx, teamId, showActions }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";

  return (
    <div class="card" style="padding: 0;">
      <a
        href={`/app/tasks/${task.id}${ctxQuery}`}
        style="text-decoration: none; color: inherit; display: block; padding: 12px;"
      >
        <div class="card-title">{task.title}</div>
        <div class="meta-row">
          <span class={`badge badge-${task.status}`}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
          <span class={`badge badge-${task.priority}`}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </span>
          {task.dueAt && (
            <span style="font-size: 11px; color: var(--tg-theme-hint-color, #94a3b8);">
              Due: {new Date(task.dueAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </a>

      {showActions && NEXT_STATUS[task.status] && (
        <div style="display: flex; gap: 4px; padding: 0 12px 10px 12px;">
          <form
            method="post"
            action={`/app/tasks/${task.id}/status${ctxQuery}`}
            style="flex: 1;"
          >
            <input type="hidden" name="ctx" value={ctx ?? ""} />
            <input type="hidden" name="status" value={NEXT_STATUS[task.status] ?? task.status} />
            <button type="submit" class="btn btn-secondary" style="width: 100%; font-size: 11px; padding: 4px 8px;">
              Move to {STATUS_LABELS[NEXT_STATUS[task.status]!]}
            </button>
          </form>
          <a
            href={`/app/tasks/${task.id}/comment${ctxQuery}`}
            class="btn btn-secondary"
            style="font-size: 11px; padding: 4px 8px;"
          >
            Comment
          </a>
        </div>
      )}
    </div>
  );
};
