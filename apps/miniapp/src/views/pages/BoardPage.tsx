import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { StatusColumn } from "../components/StatusColumn.js";
import { EmptyState } from "../components/EmptyState.js";

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
      <div class="header">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href={`/app/tasks/mine${ctxQuery}`} class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;">
              My Tasks
            </a>
            <a href={`/app/team${ctxQuery}`} class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;">
              Team
            </a>
          </div>
          <a href={`/app/tasks/new${ctxQuery}`} class="btn" style="font-size: 12px; padding: 6px 14px;">
            + New Task
          </a>
        </div>
        <h1 style="margin-top: 12px;">
          {filterStatus 
            ? `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Tasks`
            : "Task Board"}
        </h1>
        {filterStatus && (
          <a href={`/app/board/${teamId}${ctxQuery}`} style="font-size: 14px; color: var(--tg-theme-link-color, #3390ec);">
            Show all columns
          </a>
        )}
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
        <div class="columns">
          {displayColumns.map((col) => (
            <StatusColumn
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
