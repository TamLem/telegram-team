import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { TaskCard } from "../components/TaskCard.js";
import { EmptyState } from "../components/EmptyState.js";
import { MiniAppNav } from "../components/MiniAppNav.js";

export const MyTasksPage: FC<{
  tasks: TaskResponse[];
  username: string;
  ctx?: string;
  teamId?: string;
}> = ({ tasks, ctx, teamId }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={teamId} current="tasks" />

      <div class="header">
        <h1>My Tasks</h1>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No Tasks Yet"
          description="Use the bot command /newtask to create your first task."
        >
          <a href={`/app/tasks/new${ctxQuery}`} class="btn">
            Create Task
          </a>
        </EmptyState>
      ) : (
        <div>
          {tasks.map((task) => (
            <TaskCard task={task} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
};
