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

function trimDescription(desc: string | null, maxLen = 80): string | null {
  if (!desc) return null;
  if (desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen).trimEnd() + "...";
}

export const TaskCard: FC<{
  task: TaskResponse;
  ctx?: string;
  teamId?: string;
  showActions?: boolean;
  assigneeName?: string;
  variant?: "default" | "board";
}> = ({ task, showActions, assigneeName, variant }) => {
  const ctxQuery = "";
  const isBoard = variant === "board";
  const dueStr = formatDueDate(task.dueAt);
  const trimmedDesc = trimDescription(task.description);

  if (isBoard) {
    return (
      <div class="board-task">
        <div class="board-task-row">
          <a href={`/app/tasks/${task.id}${ctxQuery}`} class="board-task-main">
            <div class="board-task-body">
              <div class="board-task-title">{task.title}</div>
              {trimmedDesc && (
                <div class="board-task-desc">{trimmedDesc}</div>
              )}
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
          </a>
          <form
            method="post"
            action={`/app/tasks/${task.id}/status${ctxQuery}`}
            class="board-task-status"
          >
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
        </div>
      </div>
    );
  }

  return (
    <div class="card" style="padding:0">
      <a href={`/app/tasks/${task.id}${ctxQuery}`} style="text-decoration:none;color:inherit;display:block;padding:12px">
        <div class="card-title">{task.title}</div>
        {trimmedDesc && (
          <div style="font-size:13px;color:var(--tg-theme-hint-color,#64748b);margin:4px 0 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            {trimmedDesc}
          </div>
        )}
        <div class="meta-row">
          <span class={`badge badge-${task.status}`}>{STATUS_LABELS[task.status] ?? task.status}</span>
          <span class={`badge badge-${task.priority}`}>{PRIORITY_LABELS[task.priority] ?? task.priority}</span>
          {task.dueAt && <span style="font-size:11px;color:var(--tg-theme-hint-color,#94a3b8)">Due: {new Date(task.dueAt).toLocaleDateString()}</span>}
        </div>
      </a>
      {showActions && NEXT_STATUS[task.status] && (
        <div style="display:flex;gap:4px;padding:0 12px 10px 12px">
          <form method="post" action={`/app/tasks/${task.id}/status${ctxQuery}`} style="flex:1">
            <input type="hidden" name="status" value={NEXT_STATUS[task.status] ?? task.status} />
            <button type="submit" class="btn btn-secondary" style="width:100%;font-size:11px;padding:4px 8px">Move to {STATUS_LABELS[NEXT_STATUS[task.status]!]}</button>
          </form>
        </div>
      )}
    </div>
  );
};
