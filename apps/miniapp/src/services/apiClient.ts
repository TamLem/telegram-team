import { getEnv } from "@telegram-team/config";

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
  } catch {
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
