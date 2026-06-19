import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { TaskCard } from "./TaskCard.js";

const COLUMN_TITLES: Record<string, string> = {
  todo: "To Do",
  doing: "Doing",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const StatusColumn: FC<{
  status: string;
  label?: string;
  tasks: TaskResponse[];
  ctx?: string;
  teamId?: string;
}> = ({ status, label, tasks, ctx, teamId }) => {
  return (
    <div class="column">
      <div class="column-header">
        <h3>{label ?? COLUMN_TITLES[status] ?? status}</h3>
        <span class="column-count">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div style="padding: 24px 12px; text-align: center; color: var(--tg-theme-hint-color, #94a3b8); font-size: 13px;">
          No tasks
        </div>
      ) : (
        tasks.map((task) => <TaskCard task={task} ctx={ctx} teamId={teamId} showActions />)
      )}
    </div>
  );
};
