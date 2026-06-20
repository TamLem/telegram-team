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

const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8",
  doing: "#3b82f6",
  blocked: "#f59e0b",
  done: "#22c55e",
  cancelled: "#ec4899",
};

export const BoardSection: FC<{
  status: string;
  label?: string;
  tasks: TaskResponse[];
  ctx?: string;
  teamId?: string;
}> = ({ status, label, tasks, ctx, teamId }) => {
  const title = label ?? COLUMN_TITLES[status] ?? status;
  const color = STATUS_COLORS[status] ?? "#94a3b8";

  return (
    <details
      class={`board-section board-section--${status}`}
      open={tasks.length > 0}
    >
      <summary class="board-section-header">
        <span class="board-section-title">
          <span class="board-section-dot" style={`background: ${color}`} />
          {title}
        </span>
        <span class="board-section-count">{tasks.length}</span>
      </summary>

      <div class="board-section-body">
        {tasks.length === 0 ? (
          <div class="board-section-empty">No tasks</div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              task={task}
              ctx={ctx}
              teamId={teamId}
              variant="board"
              showActions
            />
          ))
        )}
      </div>
    </details>
  );
};
