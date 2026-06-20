import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { BoardSection } from "../components/BoardSection.js";
import { EmptyState } from "../components/EmptyState.js";
import { MiniAppNav } from "../components/MiniAppNav.js";

interface BoardColumn {
  status: string;
  label: string;
  tasks: TaskResponse[];
  count: number;
}

export const BoardPage: FC<{
  teamId: string;
  columns: BoardColumn[];
  filterStatus?: string | null;
  ctx?: string;
}> = ({ teamId, columns, filterStatus, ctx }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  const displayColumns = filterStatus
    ? columns.filter((col) => col.status === filterStatus)
    : columns;
  const totalTasks = columns.reduce((sum, col) => sum + col.count, 0);

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={teamId} current="board" />

      <div class="header">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <h1>
            {filterStatus
              ? `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Tasks`
              : "Task Board"}
          </h1>
          {filterStatus && (
            <a href={`/app/board/${teamId}${ctxQuery}`} class="board-filter-link">
              Show all
            </a>
          )}
        </div>
      </div>

      {displayColumns.length === 0 && totalTasks === 0 ? (
        <EmptyState
          icon="📋"
          title="No Tasks Yet"
          description="Create your first task to get started."
        >
          <a href={`/app/tasks/new${ctxQuery}`} class="btn">
            Create Task
          </a>
        </EmptyState>
      ) : displayColumns.length === 0 ? (
        <EmptyState
          icon="📋"
          title={`No ${filterStatus ?? ""} Tasks`}
          description="No tasks match this filter."
        />
      ) : (
        <div class="board-stacks">
          {displayColumns.map((col) => (
            <BoardSection
              status={col.status}
              label={col.label}
              tasks={col.tasks}
              ctx={ctx}
              teamId={teamId}
            />
          ))}
        </div>
      )}
    </div>
  );
};
