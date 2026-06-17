import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TaskCard: FC<{ task: TaskResponse }> = ({ task }) => {
  return (
    <a
      href={`/app/tasks/${task.id}`}
      style="text-decoration: none; color: inherit; display: block;"
    >
      <div class="card">
        <div class="card-title">{task.title}</div>
        <div class="meta-row">
          <span class={`badge badge-${task.status}`}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
          <span class={`badge badge-${task.priority}`}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </span>
        </div>
      </div>
    </a>
  );
};
