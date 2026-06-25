import { getEnv } from "@telegram-team/config";
import { generateId } from "@telegram-team/shared";
import { log } from "./logger.js";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const requestId = generateId();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function syncUser(user: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}): Promise<{ id: string }> {
  const { user: apiUser } = await apiFetch<{ user: { id: string } }>(
    `/api/users/telegram/${user.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        telegramUserId: user.id,
        firstName: user.first_name,
        lastName: user.last_name ?? null,
        telegramUsername: user.username ?? null,
      }),
    }
  );
  return apiUser;
}

export async function getActiveTeams(
  userId: string
): Promise<
  Array<{ id: string; name: string; inviteCode: string; role: string }>
> {
  try {
    const { teams } = await apiFetch<{
      teams: Array<{
        id: string;
        name: string;
        inviteCode: string;
        role: string;
      }>;
    }>(`/api/me/teams`, { headers: { "X-User-Id": userId } });
    return teams;
  } catch (err) {
    log.error("[apiClient] getActiveTeams failed", err);
    return [];
  }
}

export interface TaskItem {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdById: string;
  assignedToUserId: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyTaskSummary {
  todo: number;
  doing: number;
  blocked: number;
  done: number;
  cancelled: number;
  total: number;
}

export async function getMyTaskSummary(
  teamId: string,
  userId: string
): Promise<MyTaskSummary> {
  const summary: MyTaskSummary = { todo: 0, doing: 0, blocked: 0, done: 0, cancelled: 0, total: 0 };
  try {
    const { tasks } = await apiFetch<{ tasks: TaskItem[] }>(
      `/api/tasks?assigned_to=me&team_id=${teamId}&limit=100`,
      { headers: { "X-User-Id": userId } }
    );
    for (const t of tasks) {
      if (t.status === "todo") summary.todo++;
      else if (t.status === "doing") summary.doing++;
      else if (t.status === "blocked") summary.blocked++;
      else if (t.status === "done") summary.done++;
      else if (t.status === "cancelled") summary.cancelled++;
    }
    summary.total = tasks.length;
  } catch (err) {
    log.error("[apiClient] getMyTaskSummary failed", err);
  }
  return summary;
}

export interface BoardSummary {
  teamId: string;
  totalTasks: number;
  todo: number;
  doing: number;
  blocked: number;
  done: number;
  cancelled: number;
  dueSoon: number;
  overdue: number;
  unassigned: number;
  myTask: number;
  topBlockedTasks: Array<{
    id: string;
    title: string;
    assignedToUserId: string | null;
    assigneeName: string | null;
  }>;
}

export async function getBoardSummary(
  teamId: string,
  userId: string
): Promise<BoardSummary> {
  try {
    const raw = await apiFetch<{
      teamId: string;
      totalTasks: number;
      todoCount: number;
      doingCount: number;
      blockedCount: number;
      doneCount: number;
      cancelledCount: number;
      dueSoonCount: number;
      overdueCount: number;
      unassignedCount: number;
      myTaskCount: number;
      topBlockedTasks: Array<{
        id: string;
        title: string;
        assignedToUserId: string | null;
        assigneeName: string | null;
      }>;
    }>(
      `/api/teams/${teamId}/board-summary`,
      { headers: { "X-User-Id": userId } }
    );
    return {
      teamId: raw.teamId,
      totalTasks: raw.totalTasks,
      todo: raw.todoCount,
      doing: raw.doingCount,
      blocked: raw.blockedCount,
      done: raw.doneCount,
      cancelled: raw.cancelledCount,
      dueSoon: raw.dueSoonCount,
      overdue: raw.overdueCount,
      unassigned: raw.unassignedCount,
      myTask: raw.myTaskCount,
      topBlockedTasks: raw.topBlockedTasks,
    };
  } catch (err) {
    log.error("[apiClient] getBoardSummary failed", err);
    return { teamId: "", totalTasks: 0, todo: 0, doing: 0, blocked: 0, done: 0, cancelled: 0, dueSoon: 0, overdue: 0, unassigned: 0, myTask: 0, topBlockedTasks: [] };
  }
}
