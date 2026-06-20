import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { TaskCard } from "../components/TaskCard.js";
import { EmptyState } from "../components/EmptyState.js";
import { MiniAppNav } from "../components/MiniAppNav.js";

interface BoardColumn {
  status: string;
  label: string;
  tasks: TaskResponse[];
  count: number;
}

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
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

export const BoardPage: FC<{
  teamId: string;
  columns: BoardColumn[];
  filterStatus?: string | null;
  ctx?: string;
}> = ({ teamId, columns, filterStatus, ctx }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  const totalTasks = columns.reduce((sum, col) => sum + col.count, 0);

  // Active tab: filterStatus from URL, or first non-empty, or todo
  const activeStatus = filterStatus
    ?? columns.find((c) => c.count > 0)?.status
    ?? "todo";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={teamId} current="board" />

      <div class="header">
        <h1>Task Board</h1>
        {filterStatus && (
          <a href={`/app/board/${teamId}${ctxQuery}`} style="font-size: 14px; color: var(--tg-theme-link-color, #3390ec); text-decoration: none;">
            Show all
          </a>
        )}
      </div>

      {totalTasks === 0 ? (
        <EmptyState
          icon="📋"
          title="No Tasks Yet"
          description="Create your first task to get started."
        >
          <a href={`/app/tasks/new${ctxQuery}`} class="btn">
            Create Task
          </a>
        </EmptyState>
      ) : (
        <>
          {/* Status tabs */}
          <div class="board-tabs" role="tablist">
            {columns.map((col) => {
              const isActive = col.status === activeStatus;
              const color = STATUS_COLORS[col.status] ?? "#94a3b8";
              return (
                <button
                  class={`board-tab ${isActive ? "board-tab--active" : ""}`}
                  data-status={col.status}
                  role="tab"
                  aria-selected={isActive ? "true" : "false"}
                >
                  <span class="board-tab-dot" style={`background: ${color}`} />
                  {STATUS_LABELS[col.status] ?? col.status}
                  <span class="board-tab-count">{col.count}</span>
                </button>
              );
            })}
          </div>

          {/* Single-column task panels */}
          {columns.map((col) => {
            const isActive = col.status === activeStatus;
            return (
              <div
                id={`col-${col.status}`}
                class="board-column-panel"
                role="tabpanel"
                hidden={!isActive}
              >
                {col.tasks.length === 0 ? (
                  <div class="board-column-empty">
                    No {STATUS_LABELS[col.status]?.toLowerCase() ?? col.status} tasks
                  </div>
                ) : (
                  col.tasks.map((task) => (
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
            );
          })}
        </>
      )}
    </div>
  );
};
