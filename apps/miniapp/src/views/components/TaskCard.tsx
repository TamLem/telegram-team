import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
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

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo" },
  { value: "doing", label: "Doing" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const NEXT_STATUS: Record<string, string | null> = {
  todo: "doing",
  doing: "done",
  blocked: "done",
  done: null,
  cancelled: null,
};

function formatDueDate(dateString: string | null): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const TaskCard: FC<{
  task: TaskResponse;
  ctx?: string;
  teamId?: string;
  showActions?: boolean;
  assigneeName?: string;
  variant?: "default" | "board";
}> = ({ task, ctx, teamId, showActions, assigneeName, variant }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  const isBoard = variant === "board";
  const dueStr = formatDueDate(task.dueAt);

  if (isBoard) {
    return (
      <div class="board-task">
        <a href={`/app/tasks/${task.id}${ctxQuery}`} class="board-task-main">
          <div class="board-task-body">
            <div class="board-task-title">{task.title}</div>
            <div class="board-task-meta">
              <span class={`badge badge-${task.priority}`} style="font-size: 10px; padding: 2px 6px;">
                {PRIORITY_LABELS[task.priority] ?? task.priority}
              </span>
              {dueStr && <span class="board-task-due">{dueStr}</span>}
              <span class="board-task-assignee">
                {task.assignedToUserId ? (assigneeName ?? task.assignedToUserId.slice(0, 8)) : "Unassigned"}
              </span>
            </div>
          </div>
          <svg class="board-task-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>

        {showActions && (
          <div class="board-task-actions">
            <form method="post" action={`/app/tasks/${task.id}/status${ctxQuery}`} style="flex:1">
              <input type="hidden" name="ctx" value={ctx ?? ""} />
              <select
                name="status"
                class="board-task-select"
                onchange="this.form.submit()"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option value={s.value} selected={task.status === s.value}>{s.label}</option>
                ))}
              </select>
            </form>
            <a href={`/app/tasks/${task.id}/comment${ctxQuery}`} class="board-task-btn board-task-btn--ghost">
              Comment
            </a>
          </div>
        )}
      </div>
    );
  }

  // Default full card (used elsewhere)
  return (
    <div class="card" style="padding:0">
      <a href={`/app/tasks/${task.id}${ctxQuery}`} style="text-decoration:none;color:inherit;display:block;padding:12px">
        <div class="card-title">{task.title}</div>
        <div class="meta-row">
          <span class={`badge badge-${task.status}`}>{STATUS_LABELS[task.status] ?? task.status}</span>
          <span class={`badge badge-${task.priority}`}>{PRIORITY_LABELS[task.priority] ?? task.priority}</span>
          {task.dueAt && <span style="font-size:11px;color:var(--tg-theme-hint-color,#94a3b8)">Due: {new Date(task.dueAt).toLocaleDateString()}</span>}
        </div>
      </a>
      {showActions && NEXT_STATUS[task.status] && (
        <div style="display:flex;gap:4px;padding:0 12px 10px 12px">
          <form method="post" action={`/app/tasks/${task.id}/status${ctxQuery}`} style="flex:1">
            <input type="hidden" name="ctx" value={ctx ?? ""} />
            <input type="hidden" name="status" value={NEXT_STATUS[task.status] ?? task.status} />
            <button type="submit" class="btn btn-secondary" style="width:100%;font-size:11px;padding:4px 8px">Move to {STATUS_LABELS[NEXT_STATUS[task.status]!]}</button>
          </form>
          <a href={`/app/tasks/${task.id}/comment${ctxQuery}`} class="btn btn-secondary" style="font-size:11px;padding:4px 8px">Comment</a>
        </div>
      )}
    </div>
  );
};
