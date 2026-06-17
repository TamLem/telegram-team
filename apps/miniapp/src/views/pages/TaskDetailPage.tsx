import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { Button } from "../components/Button.js";

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

function formatDueDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusActions(task: TaskResponse) {
  const allActions: { label: string; newStatus: string; variant: "primary" | "secondary" }[] = [];
  if (task.status === "todo") {
    allActions.push({ label: "Start Doing", newStatus: "doing", variant: "primary" });
  }
  if (task.status === "todo" || task.status === "doing") {
    allActions.push({ label: "Block", newStatus: "blocked", variant: "secondary" });
  }
  if (task.status !== "done" && task.status !== "cancelled") {
    allActions.push({ label: "Complete", newStatus: "done", variant: "primary" });
  }
  if (task.status !== "cancelled") {
    allActions.push({ label: "Cancel", newStatus: "cancelled", variant: "secondary" });
  }
  return allActions.filter((a) => a.newStatus !== task.status);
}

export const TaskDetailPage: FC<{
  task: TaskResponse | null;
  comments?: Array<{ id: string; body: string; userId: string; createdAt: string; user?: { firstName: string; telegramUsername: string | null } | null }>;
  events?: Array<{ id: string; eventType: string; actorUserId: string; oldValue: string | null; newValue: string | null; createdAt: string }>;
}> = ({ task, comments, events }) => {
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
          <p style="margin-top: 12px; white-space: pre-wrap; color: var(--tg-theme-text-color, #475569); font-size: 14px; line-height: 1.6;">
            {task.description}
          </p>
        ) : (
          <p style="margin-top: 12px; color: var(--tg-theme-hint-color, #94a3b8); font-size: 14px; font-style: italic;">
            No description provided.
          </p>
        )}

        <div style="margin-top: 12px; font-size: 13px; color: var(--tg-theme-hint-color, #64748b); display: flex; flex-wrap: wrap; gap: 12px;">
          <span>Due: {task.dueAt ? formatDueDate(task.dueAt) : "Not set"}</span>
          <span>Assigned: {task.assignedToUserId ? "Yes" : "Unassigned"}</span>
        </div>

        <div style="margin-top: 16px; font-size: 12px; color: var(--tg-theme-hint-color, #94a3b8);">
          Created: {formatDate(task.createdAt)}
          {task.updatedAt !== task.createdAt && (
            <span>
              {" "}&middot; Updated: {formatDate(task.updatedAt)}
            </span>
          )}
          {task.completedAt && (
            <span>
              {" "}&middot; Completed: {formatDate(task.completedAt)}
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
                <input type="hidden" name="status" value={action.newStatus} />
                <Button type="submit" variant={action.variant}>
                  {action.label}
                </Button>
              </form>
            ))}
          </div>
        </div>
      )}

      {comments && comments.length > 0 && (
        <div class="card">
          <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
            Comments ({comments.length})
          </h3>
          {comments.map((comment) => (
            <div class="comment">
              <div class="comment-meta">
                {comment.user?.firstName ?? comment.userId}
                {" "}&middot;{" "}
                {formatDate(comment.createdAt)}
              </div>
              <div class="comment-body">{comment.body}</div>
            </div>
          ))}
        </div>
      )}

      {events && events.length > 0 && (
        <div class="card">
          <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
            Activity
          </h3>
          {events.map((event) => (
            <div style="font-size: 13px; padding: 4px 0; color: var(--tg-theme-hint-color, #64748b);">
              {event.eventType.replace(/_/g, " ")}
              {event.oldValue && event.newValue && (
                <span>: {event.oldValue} → {event.newValue}</span>
              )}
              {" "}&middot;{" "}
              <span style="font-size: 12px;">{formatDate(event.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
