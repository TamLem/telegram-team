import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { StatusColumn } from "../components/StatusColumn.js";

const COLUMN_ORDER = ["todo", "in_progress", "done", "cancelled"];

export const BoardPage: FC<{
  teamId: string;
  tasks: TaskResponse[];
}> = ({ teamId, tasks }) => {
  const columns = COLUMN_ORDER.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  }));

  return (
    <div>
      <div class="header">
        <a href="/app/tasks/mine" class="back-link">
          &larr; My Tasks
        </a>
        <h1>Task Board</h1>
      </div>

      <div class="columns">
        {columns.map((col) => (
          <StatusColumn status={col.status} tasks={col.tasks} />
        ))}
      </div>
    </div>
  );
};
