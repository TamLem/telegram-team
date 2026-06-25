import type { FC } from "hono/jsx";
import { Button } from "../components/Button.js";
import { MiniAppNav } from "../components/MiniAppNav.js";
import type { TaskResponse } from "../../services/apiClient.js";

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo" },
  { value: "doing", label: "Doing" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export const StatusPage: FC<{
  task: TaskResponse;
  ctx?: string;
}> = ({ task, ctx }) => {
  const ctxQuery = "";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={task.teamId} />

      <a href={`/app/tasks/${task.id}${ctxQuery}`} class="back-link">
        &larr; Back to Task
      </a>

      <div class="header">
        <h1>Change Status</h1>
      </div>

      <div class="card">
        <p style="font-size: 14px; color: var(--tg-theme-hint-color, #64748b); margin-bottom: 16px;">
          Task: <b>{task.title}</b>
        </p>
        <p style="font-size: 13px; color: var(--tg-theme-hint-color, #94a3b8); margin-bottom: 16px;">
          Current status: <span class={`badge badge-${task.status}`}>{task.status}</span>
        </p>

        {STATUS_OPTIONS.filter((s) => s.value !== task.status).map((status) => (
          <form
            method="post"
            action={`/app/tasks/${task.id}/status${ctxQuery}`}
            style="margin-bottom: 8px;"
          >
            <input type="hidden" name="status" value={status.value} />
            <input type="hidden" name="ctx" value={ctx ?? ""} />
            <Button type="submit" block variant={status.value === "done" ? "primary" : "secondary"}>
              Mark as {status.label}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
};
