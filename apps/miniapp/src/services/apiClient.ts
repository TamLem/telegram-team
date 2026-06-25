import { getEnv } from "@telegram-team/config";
import { createLogger } from "@telegram-team/shared";

const log = createLogger("miniapp");
const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");

export interface UserResponse {
  id: string;
  telegramUserId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface TeamResponse {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskResponse {
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
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface CommentResponse {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
  user?: { firstName: string; telegramUsername: string | null } | null;
}

export interface EventResponse {
  id: string;
  taskId: string;
  teamId: string;
  actorUserId: string;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor?: { firstName: string; telegramUsername: string | null } | null;
  assigneeOldName?: string | null;
  assigneeNewName?: string | null;
}

export interface TeamEventResponse {
  id: string;
  teamId: string;
  actorUserId: string;
  targetUserId: string | null;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor?: { firstName: string; telegramUsername: string | null } | null;
  targetUser?: { firstName: string; telegramUsername: string | null } | null;
}

export interface JoinRequestResponse {
  id: string;
  teamId: string;
  userId: string;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function getOrCreateUser(telegramId: number, data: {
  firstName: string;
  lastName?: string | null;
  username?: string | null;
}): Promise<UserResponse> {
  const res = await apiFetch<{ user: UserResponse }>(
    `/api/users/telegram/${telegramId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        telegramUserId: telegramId,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        telegramUsername: data.username ?? null,
      }),
    }
  );
  return res.user;
}

export async function getUserTeams(userId: string) {
  const res = await apiFetch<{ teams: (TeamResponse & { role: string })[] }>(
    "/api/me/teams",
    { headers: { "X-User-Id": userId } }
  );
  return res.teams;
}

export async function createTeam(userId: string, name: string): Promise<TeamResponse> {
  const res = await apiFetch<{ team: TeamResponse }>(
    "/api/teams",
    {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ name }),
    }
  );
  return res.team;
}

export async function joinTeam(userId: string, inviteCode: string): Promise<JoinRequestResponse> {
  const res = await apiFetch<{ request: JoinRequestResponse }>(
    "/api/teams/join",
    {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ inviteCode }),
    }
  );
  return res.request;
}

export async function getMyTasks(userId: string, teamId?: string): Promise<TaskResponse[]> {
  const path = teamId
    ? `/api/tasks?assigned_to=me&team_id=${teamId}&limit=50`
    : `/api/tasks?assigned_to=me&limit=50`;
  const res = await apiFetch<{ tasks: TaskResponse[] }>(path, {
    headers: { "X-User-Id": userId },
  });
  return res.tasks;
}

export async function getTask(
  taskId: string,
  userId: string
): Promise<TaskResponse | null> {
  try {
    const res = await apiFetch<{ task: TaskResponse }>(
      `/api/tasks/${taskId}`,
      { headers: { "X-User-Id": userId } }
    );
    return res.task;
  } catch (err) {
    log.error("[apiClient] getTask failed", err, { taskId });
    return null;
  }
}

export async function getTaskComments(
  taskId: string,
  userId: string
): Promise<CommentResponse[]> {
  const res = await apiFetch<{ comments: CommentResponse[] }>(
    `/api/tasks/${taskId}/comments`,
    { headers: { "X-User-Id": userId } }
  );
  return res.comments;
}

export async function getTaskEvents(
  taskId: string,
  userId: string
): Promise<EventResponse[]> {
  const res = await apiFetch<{ events: EventResponse[] }>(
    `/api/tasks/${taskId}/events`,
    { headers: { "X-User-Id": userId } }
  );
  return res.events;
}

export async function getBoardTasks(teamId: string, userId: string): Promise<TaskResponse[]> {
  const res = await apiFetch<{ tasks: TaskResponse[] }>(
    `/api/tasks?team_id=${teamId}&limit=100`,
    { headers: { "X-User-Id": userId } }
  );
  return res.tasks;
}

export async function getBoard(teamId: string, userId: string): Promise<{
  columns: Array<{ status: string; label: string; tasks: TaskResponse[]; count: number }>;
}> {
  const res = await apiFetch<{
    columns: Array<{ status: string; label: string; tasks: TaskResponse[]; count: number }>;
  }>(`/api/teams/${teamId}/board`, {
    headers: { "X-User-Id": userId },
  });
  return res;
}

export async function createTask(input: {
  title: string;
  description?: string | null;
  priority?: string;
  assignedToUserId?: string | null;
  dueAt?: string | null;
  teamId: string;
  createdById: string;
}): Promise<TaskResponse> {
  const res = await apiFetch<{ task: TaskResponse }>(
    "/api/tasks",
    {
      method: "POST",
      headers: {
        "X-User-Id": input.createdById,
        "X-Team-Id": input.teamId,
      },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        priority: input.priority,
        assignedToUserId: input.assignedToUserId,
        dueAt: input.dueAt,
      }),
    }
  );
  return res.task;
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  userId: string
): Promise<TaskResponse> {
  const res = await apiFetch<{ task: TaskResponse }>(
    `/api/tasks/${taskId}/status`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ status }),
    }
  );
  return res.task;
}

export async function addTaskComment(
  taskId: string,
  body: string,
  userId: string
): Promise<CommentResponse> {
  const res = await apiFetch<{ comment: CommentResponse }>(
    `/api/tasks/${taskId}/comments`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ body }),
    }
  );
  return res.comment;
}

export async function deleteTask(
  taskId: string,
  userId: string
): Promise<{ ok: boolean }> {
  const res = await apiFetch<{ ok: boolean; error?: string }>(
    `/api/tasks/${taskId}`,
    {
      method: "DELETE",
      headers: { "X-User-Id": userId },
    }
  );
  return res;
}

export interface TeamMemberResponse {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
  user: {
    id: string;
    firstName: string;
    telegramUsername: string | null;
  };
}

export async function getTeamMembers(
  teamId: string,
  userId: string
): Promise<TeamMemberResponse[]> {
  const res = await apiFetch<{ members: TeamMemberResponse[] }>(
    `/api/teams/${teamId}/members`,
    { headers: { "X-User-Id": userId } }
  );
  return res.members;
}

export async function updateTask(
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    priority?: string;
    dueAt?: string | null;
    assignedToUserId?: string | null;
  },
  userId: string
): Promise<TaskResponse> {
  const res = await apiFetch<{ task: TaskResponse }>(
    `/api/tasks/${taskId}`,
    {
      method: "PATCH",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(input),
    }
  );
  return res.task;
}

export async function assignTask(
  taskId: string,
  assignedToUserId: string,
  userId: string
): Promise<TaskResponse> {
  const res = await apiFetch<{ task: TaskResponse }>(
    `/api/tasks/${taskId}/assign`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ assignedToUserId }),
    }
  );
  return res.task;
}

export async function getTeam(teamId: string, userId: string): Promise<{
  team: TeamResponse;
  memberCount: number;
  pendingRequestCount: number;
}> {
  return apiFetch<{ team: TeamResponse; memberCount: number; pendingRequestCount: number }>(
    `/api/teams/${teamId}`,
    { headers: { "X-User-Id": userId } }
  );
}

export async function updateTeam(teamId: string, name: string, userId: string): Promise<TeamResponse> {
  const res = await apiFetch<{ team: TeamResponse }>(
    `/api/teams/${teamId}`,
    {
      method: "PATCH",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ name }),
    }
  );
  return res.team;
}

export async function regenerateInviteCode(teamId: string, userId: string): Promise<string> {
  const res = await apiFetch<{ inviteCode: string }>(
    `/api/teams/${teamId}/invite-code/regenerate`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
    }
  );
  return res.inviteCode;
}

export async function removeMember(teamId: string, memberUserId: string, userId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/api/teams/${teamId}/members/${memberUserId}/remove`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
    }
  );
}

export async function updateMemberRole(teamId: string, memberUserId: string, role: string, userId: string): Promise<void> {
  await apiFetch<{ member: TeamMemberResponse }>(
    `/api/teams/${teamId}/members/${memberUserId}/role`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ role }),
    }
  );
}

export async function getJoinRequests(teamId: string, userId: string): Promise<(JoinRequestResponse & { user: { id: string; firstName: string; telegramUsername: string | null } })[]> {
  const res = await apiFetch<{ requests: (JoinRequestResponse & { user: { id: string; firstName: string; telegramUsername: string | null } })[] }>(
    `/api/teams/${teamId}/join-requests`,
    { headers: { "X-User-Id": userId } }
  );
  return res.requests;
}

export async function approveJoinRequest(teamId: string, requestId: string, userId: string): Promise<JoinRequestResponse> {
  const res = await apiFetch<{ request: JoinRequestResponse }>(
    `/api/teams/${teamId}/join-requests/${requestId}/approve`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
    }
  );
  return res.request;
}

export async function rejectJoinRequest(teamId: string, requestId: string, userId: string): Promise<JoinRequestResponse> {
  const res = await apiFetch<{ request: JoinRequestResponse }>(
    `/api/teams/${teamId}/join-requests/${requestId}/reject`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
    }
  );
  return res.request;
}

export async function getTeamActivity(teamId: string, userId: string): Promise<TeamEventResponse[]> {
  const res = await apiFetch<{ events: TeamEventResponse[] }>(
    `/api/teams/${teamId}/activity`,
    { headers: { "X-User-Id": userId } }
  );
  return res.events;
}
