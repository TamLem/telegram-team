import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { StatusColumn } from "../components/StatusColumn.js";

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

  return (
    <div>
      <div class="header">
        <a href={`/app/tasks/mine${ctxQuery}`} class="back-link">
          &larr; My Tasks
        </a>
        <h1>
          {filterStatus ? `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Tasks` : "Task Board"}
        </h1>
        {filterStatus && (
          <a href={`/app/board/${teamId}${ctxQuery}`} style="font-size: 14px; color: var(--tg-theme-link-color, #3390ec);">
            Show all columns
          </a>
        )}
      </div>

      {displayColumns.length === 0 && (
        <div class="empty-state">
          <h2>No {filterStatus ?? ""} tasks</h2>
        </div>
      )}

      <div class="columns">
        {displayColumns.map((col) => (
          <StatusColumn
            status={col.status}
            label={col.label}
            tasks={col.tasks}
          />
        ))}
      </div>
    </div>
  );
};
