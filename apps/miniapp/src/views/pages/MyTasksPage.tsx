import type { FC } from "hono/jsx";
import type { TaskResponse } from "../../services/apiClient.js";
import { TaskCard } from "../components/TaskCard.js";
import { EmptyState } from "../components/EmptyState.js";
import { MiniAppNav } from "../components/MiniAppNav.js";

const OPEN = new Set(["todo", "doing", "blocked"]);

export const MyTasksPage: FC<{
  tasks: TaskResponse[];
  teams: Array<{ id: string; name: string; role: string }>;
  activeTeamId?: string;
}> = ({ tasks, teams, activeTeamId }) => {
  const openTasks = tasks.filter((t) => OPEN.has(t.status));
  const teamName =
    teams.find((t) => t.id === activeTeamId)?.name ??
    teams[0]?.name;

  const byTeam = new Map<string, TaskResponse[]>();
  for (const task of openTasks) {
    const list = byTeam.get(task.teamId) ?? [];
    list.push(task);
    byTeam.set(task.teamId, list);
  }

  return (
    <div>
      <MiniAppNav
        teamId={activeTeamId}
        teamName={teamName}
        teams={teams}
        current="mytasks"
      />

      <div class="header">
        <h1>My Tasks</h1>
        <p class="card-subtitle">
          Open work across all your teams ({openTasks.length})
        </p>
      </div>

      {openTasks.length === 0 ? (
        <EmptyState
          title="No open tasks"
          description="Tasks assigned to you will show up here across every team."
        />
      ) : (
        Array.from(byTeam.entries()).map(([teamId, teamTasks]) => {
          const name =
            teamTasks[0]?.teamName ??
            teams.find((t) => t.id === teamId)?.name ??
            "Team";
          return (
            <section class="my-tasks-team" style="margin-bottom: 20px;">
              <div class="header" style="margin-bottom: 8px;">
                <h2 style="font-size: 15px;">{name}</h2>
                <a
                  href={`/app/board/${teamId}?assignee=me`}
                  class="card-subtitle"
                  style="text-decoration: none;"
                >
                  Open board →
                </a>
              </div>
              {teamTasks.map((task) => (
                <TaskCard task={task} teamId={teamId} />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
};
