import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { Button } from "../components/Button.js";

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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusActions(task: TaskResponse) {
  const allActions = [
    { label: "Start", newStatus: "in_progress", variant: "primary" as const },
    { label: "Complete", newStatus: "done", variant: "primary" as const },
    { label: "Cancel", newStatus: "cancelled", variant: "secondary" as const },
  ];
  return allActions.filter((a) => a.newStatus !== task.status);
}

export const TaskDetailPage: FC<{
  task: TaskResponse | null;
}> = ({ task }) => {
  if (!task) {
    return (
      <div>
        <a href="/app/tasks/mine" class="back-link">
          &larr; Back
        </a>
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h2>Task Not Found</h2>
          <p>This task may have been deleted or you don't have access.</p>
        </div>
      </div>
    );
  }

  const actions = statusActions(task);

  return (
    <div>
      <a href="/app/tasks/mine" class="back-link">
        &larr; Back to My Tasks
      </a>

      <div class="card">
        <h2 style="font-size: 20px; font-weight: 700; line-height: 1.3;">
          {task.title}
        </h2>

        <div class="meta-row">
          <span class={`badge badge-${task.status}`}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
          <span class={`badge badge-${task.priority}`}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </span>
        </div>

        {task.description ? (
          <p
            style="margin-top: 12px; white-space: pre-wrap; color: var(--tg-theme-text-color, #475569); font-size: 14px; line-height: 1.6;"
          >
            {task.description}
          </p>
        ) : (
          <p
            style="margin-top: 12px; color: var(--tg-theme-hint-color, #94a3b8); font-size: 14px; font-style: italic;"
          >
            No description provided.
          </p>
        )}

        <div style="margin-top: 16px; font-size: 12px; color: var(--tg-theme-hint-color, #94a3b8);">
          Created: {formatDate(task.createdAt)}
          {task.updatedAt !== task.createdAt && (
            <span>
              {" "}&middot; Updated: {formatDate(task.updatedAt)}
            </span>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div class="card">
          <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
            Change Status
          </h3>
          <div class="task-actions">
            {actions.map((action) => (
              <form
                method="post"
                action={`/app/tasks/${task.id}/status`}
                style="display: inline;"
              >
                <input
                  type="hidden"
                  name="status"
                  value={action.newStatus}
                />
                <Button
                  type="submit"
                  variant={action.variant}
                >
                  {action.label}
                </Button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
