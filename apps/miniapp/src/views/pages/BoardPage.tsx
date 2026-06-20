import type { FC } from "hono/jsx";
import type { TaskResponse, TeamMemberResponse } from "../../services/apiClient.js";
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

function filterTasksByAssignee(tasks: TaskResponse[], assignee: string | null, currentUserId: string): TaskResponse[] {
  if (!assignee) return tasks;
  if (assignee === "me") return tasks.filter((t) => t.assignedToUserId === currentUserId);
  return tasks.filter((t) => t.assignedToUserId === assignee);
}

// ── inline tab-switching script (runs once, uses onclick on each tab) ──
const BOARD_SCRIPT = `
(function(){
  var active = document.querySelector('.board-tab--active');
  if (!active) return;
  // Show the active panel on load (belt-and-suspenders)
  var initial = active.getAttribute('data-status');
  var panel = document.getElementById('col-' + initial);
  if (panel) panel.style.display = '';
})();
`;

export const BoardPage: FC<{
  teamId: string;
  columns: BoardColumn[];
  filterStatus?: string | null;
  filterAssignee?: string | null;
  members?: TeamMemberResponse[];
  currentUserId?: string;
  ctx?: string;
}> = ({ teamId, columns, filterStatus, filterAssignee, members = [], currentUserId = "", ctx }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";

  const filteredColumns = filterAssignee
    ? columns.map((col) => ({
        ...col,
        tasks: filterTasksByAssignee(col.tasks, filterAssignee, currentUserId),
        count: filterTasksByAssignee(col.tasks, filterAssignee, currentUserId).length,
      }))
    : columns;

  const totalTasks = filteredColumns.reduce((sum, col) => sum + col.count, 0);
  const activeStatus = filterStatus ?? filteredColumns.find((c) => c.count > 0)?.status ?? "todo";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={teamId} current="board" />

      <div class="header">
        <h1>{filterAssignee === "me" ? "My Tasks" : "Task Board"}</h1>
        {filterStatus && (
          <a href={`/app/board/${teamId}${ctxQuery}`} style="font-size: 14px; color: var(--tg-theme-link-color, #3390ec); text-decoration: none;">
            Show all
          </a>
        )}
      </div>

      {members.length > 0 && (
        <div style="margin-bottom: 12px;">
          <select class="form-select" style="font-size: 13px; padding: 8px 10px;"
            onchange={`var v=this.value,u='${ctxQuery}';var q=u?(u.indexOf('assignee=')!==-1?u.replace(/assignee=[^&]*/,'assignee='+v):u+'&assignee='+v):'?assignee='+v;if(!v)q=u.replace(/[?&]assignee=[^&]*/,'').replace(/&$/,'').replace(/\\?$/,'');window.location.href='/app/board/${teamId}'+q`}>
            <option value="" selected={!filterAssignee}>Everyone</option>
            <option value="me" selected={filterAssignee === "me"}>Me</option>
            {members
              .filter((m) => m.userId !== currentUserId)
              .map((m) => (
                <option value={m.userId} selected={filterAssignee === m.userId}>
                  {m.user.firstName}{m.user.telegramUsername ? ` (@${m.user.telegramUsername})` : ""}
                </option>
              ))}
          </select>
        </div>
      )}

      {totalTasks === 0 ? (
        <EmptyState icon="📋" title="No Tasks Yet" description="Create your first task to get started.">
          <a href={`/app/tasks/new${ctxQuery}`} class="btn">Create Task</a>
        </EmptyState>
      ) : (
        <>
          <div class="board-tabs" role="tablist">
            {filteredColumns.map((col) => {
              const isActive = col.status === activeStatus;
              const color = STATUS_COLORS[col.status] ?? "#94a3b8";
              const statuses = filteredColumns.map((c) => c.status);
              return (
                <button
                  type="button"
                  class={`board-tab${isActive ? " board-tab--active" : ""}`}
                  data-status={col.status}
                  role="tab"
                  aria-selected={isActive ? "true" : "false"}
                  onclick={`switchBoardTab('${col.status}',${JSON.stringify(statuses)})`}
                >
                  <span class="board-tab-dot" style={`background: ${color}`} />
                  {STATUS_LABELS[col.status] ?? col.status}
                  <span class="board-tab-count">{col.count}</span>
                </button>
              );
            })}
          </div>

          {filteredColumns.map((col) => {
            const isActive = col.status === activeStatus;
            return (
              <div
                id={`col-${col.status}`}
                class="board-column-panel"
                role="tabpanel"
                style={isActive ? "" : "display:none"}
              >
                {col.tasks.length === 0 ? (
                  <div class="board-column-empty">
                    No {STATUS_LABELS[col.status]?.toLowerCase() ?? col.status} tasks
                  </div>
                ) : (
                  col.tasks.map((task) => (
                    <TaskCard task={task} ctx={ctx} teamId={teamId} variant="board" showActions />
                  ))
                )}
              </div>
            );
          })}

          <script dangerouslySetInnerHTML={{
            __html: `function switchBoardTab(status,all){for(var i=0;i<all.length;i++){var t=document.querySelector('.board-tab[data-status=\"'+all[i]+'\"]');if(t)t.className=t.className.replace(/ board-tab--active/g,'');var p=document.getElementById('col-'+all[i]);if(p)p.style.display='none'}var a=document.querySelector('.board-tab[data-status=\"'+status+'\"]');if(a)a.className+=' board-tab--active';var d=document.getElementById('col-'+status);if(d)d.style.display=''}`,
          }} />
        </>
      )}
    </div>
  );
};
