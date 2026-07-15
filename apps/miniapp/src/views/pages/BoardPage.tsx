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
  todo: "Todo", doing: "Doing", blocked: "Blocked", done: "Done", cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8", doing: "#3b82f6", blocked: "#f59e0b", done: "#22c55e", cancelled: "#ec4899",
};

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function filterByAssignee(tasks: TaskResponse[], assignee: string | null, currentUserId: string): TaskResponse[] {
  if (!assignee) return tasks;
  if (assignee === "me") return tasks.filter((t) => t.assignedToUserId === currentUserId);
  return tasks.filter((t) => t.assignedToUserId === assignee);
}

function filterByPriority(tasks: TaskResponse[], priority: string | null): TaskResponse[] {
  if (!priority) return tasks;
  return tasks.filter((t) => t.priority === priority);
}

function buildMemberMap(members: TeamMemberResponse[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of members) {
    map[m.userId] = m.user.firstName + (m.user.telegramUsername ? ` @${m.user.telegramUsername}` : "");
  }
  return map;
}

export const BoardPage: FC<{
  teamId: string;
  teamName?: string;
  teams?: Array<{ id: string; name: string; role: string }>;
  columns: BoardColumn[];
  filterStatus?: string | null;
  filterAssignee?: string | null;
  filterPriority?: string | null;
  members?: TeamMemberResponse[];
  currentUserId?: string;
  ctx?: string;
}> = ({
  teamId,
  teamName,
  teams = [],
  columns,
  filterStatus,
  filterAssignee,
  filterPriority,
  members = [],
  currentUserId = "",
}) => {
  const memberMap = buildMemberMap(members);

  const filteredColumns = columns.map((col) => {
    let tasks = col.tasks;
    tasks = filterByAssignee(tasks, filterAssignee ?? null, currentUserId);
    tasks = filterByPriority(tasks, filterPriority ?? null);
    return { ...col, tasks, count: tasks.length };
  });

  const totalTasks = filteredColumns.reduce((sum, col) => sum + col.count, 0);
  const activeStatus = filterStatus ?? filteredColumns.find((c) => c.count > 0)?.status ?? "todo";

  const baseUrl = `/app/board/${teamId}`;

  return (
    <div>
      <MiniAppNav
        teamId={teamId}
        teamName={teamName}
        teams={teams}
        current="board"
      />

      {filterAssignee === "me" ? (
        <p class="page-summary">
          Filtered to <strong>my tasks</strong>
          {teamName ? ` on ${teamName}` : ""}
        </p>
      ) : (
        <p class="page-summary">
          {totalTasks} task{totalTasks === 1 ? "" : "s"}
          {teamName ? ` · ${teamName}` : ""}
        </p>
      )}

      {/* Filters row */}
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <select class="form-select" style="font-size:13px;padding:8px 10px" id="filter-assignee">
          <option value="" selected={!filterAssignee}>Everyone</option>
          <option value="me" selected={filterAssignee === "me"}>Me</option>
          {members.filter((m) => m.userId !== currentUserId).map((m) => (
            <option value={m.userId} selected={filterAssignee === m.userId}>
              {m.user.firstName}{m.user.telegramUsername ? ` @${m.user.telegramUsername}` : ""}
            </option>
          ))}
        </select>

        <select class="form-select" style="font-size:13px;padding:8px 10px" id="filter-priority">
          {PRIORITY_OPTIONS.map((p) => (
            <option value={p.value} selected={(filterPriority || "") === p.value}>{p.label}</option>
          ))}
        </select>

        {(filterAssignee || filterPriority) && (
          <a href={baseUrl} style="font-size:13px;color:var(--tg-theme-link-color,#3390ec);text-decoration:none;padding:8px 4px;white-space:nowrap">
            Clear
          </a>
        )}
      </div>

      {totalTasks === 0 ? (
        <EmptyState icon="📋" title="No Tasks" description="No tasks match the current filters.">
          <a href="/app/tasks/new" class="btn">Create Task</a>
        </EmptyState>
      ) : (
        <>
          <div class="board-tabs" role="tablist">
            {filteredColumns.map((col) => {
              const isActive = col.status === activeStatus;
              const color = STATUS_COLORS[col.status] ?? "#94a3b8";
              const statuses = filteredColumns.map((c) => c.status);
              return (
                <button type="button"
                  class={`board-tab${isActive ? " board-tab--active" : ""}`}
                  data-status={col.status} role="tab"
                  aria-selected={isActive ? "true" : "false"}
                  onclick={`switchBoardTab('${col.status}',${JSON.stringify(statuses)})`}>
                  <span class="board-tab-dot" style={`background:${color}`} />
                  {STATUS_LABELS[col.status] ?? col.status}
                  <span class="board-tab-count">{col.count}</span>
                </button>
              );
            })}
          </div>

          {filteredColumns.map((col) => (
            <div id={`col-${col.status}`} class="board-column-panel" role="tabpanel"
              style={col.status === activeStatus ? "" : "display:none"}>
              {col.tasks.length === 0 ? (
                <div class="board-column-empty">No {STATUS_LABELS[col.status]?.toLowerCase() ?? col.status} tasks</div>
              ) : (
                col.tasks.map((task) => (
                  <TaskCard task={task} teamId={teamId} variant="board" showActions
                    assigneeName={task.assignedToUserId ? memberMap[task.assignedToUserId] : undefined} />
                ))
              )}
            </div>
          ))}

          <script dangerouslySetInnerHTML={{
            __html: [
              'function switchBoardTab(status,all){',
              'for(var i=0;i<all.length;i++){',
              'var t=document.querySelector(\'.board-tab[data-status="\'+all[i]+\'"]\');',
              'if(t)t.className=t.className.replace(/ board-tab--active/g,"");',
              'var p=document.getElementById("col-"+all[i]);',
              'if(p)p.style.display="none"',
              '}',
              'var a=document.querySelector(\'.board-tab[data-status="\'+status+\'"]\');',
              'if(a)a.className+=" board-tab--active";',
              'var d=document.getElementById("col-"+status);',
              'if(d)d.style.display=""',
              '}',
              ';',
              'document.getElementById("filter-assignee").onchange=function(){',
              'var v=this.value,qs="";',
              'if(v)qs="?assignee="+v;',
              `var p=document.getElementById("filter-priority").value;`,
              'if(p)qs+=qs?"&priority="+p:"?priority="+p;',
              `window.location="${baseUrl}"+qs`,
              '};',
              'document.getElementById("filter-priority").onchange=function(){',
              'var v=this.value,qs="";',
              'if(v)qs="?priority="+v;',
              `var a=document.getElementById("filter-assignee").value;`,
              'if(a)qs+=qs?"&assignee="+a:"?assignee="+a;',
              `window.location="${baseUrl}"+qs`,
              '};',
            ].join(''),
          }} />
        </>
      )}
    </div>
  );
};
