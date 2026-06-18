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
  ctx?: string;
}> = ({ teamId, columns, ctx }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  return (
    <div>
      <div class="header">
        <a href={`/app/tasks/mine${ctxQuery}`} class="back-link">
          &larr; My Tasks
        </a>
        <h1>Task Board</h1>
      </div>

      <div class="columns">
        {columns.map((col) => (
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
