const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

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
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  teamId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentResponse {
  id: string;
  taskId: string;
  userId: string;
  content: string;
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

export async function getUserTeams(userId: string): Promise<(TeamResponse & { role: string })[]> {
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

export async function getMyTasks(userId: string): Promise<TaskResponse[]> {
  const res = await apiFetch<{ tasks: TaskResponse[] }>(
    `/api/tasks?assigneeId=${userId}&limit=50`,
    { headers: { "X-User-Id": userId } }
  );
  return res.tasks;
}

export async function getTask(id: string): Promise<TaskResponse | null> {
  try {
    const res = await apiFetch<{ task: TaskResponse }>(
      `/api/tasks/${id}`
    );
    return res.task;
  } catch {
    return null;
  }
}

export async function getBoardTasks(teamId: string, userId: string): Promise<TaskResponse[]> {
  const res = await apiFetch<{ tasks: TaskResponse[] }>(
    `/api/tasks?teamId=${teamId}&limit=100`,
    { headers: { "X-User-Id": userId } }
  );
  return res.tasks;
}

export async function createTask(input: {
  title: string;
  description?: string | null;
  priority?: string;
  assigneeId?: string | null;
  teamId: string;
  createdById: string;
}): Promise<TaskResponse> {
  const res = await apiFetch<{ task: TaskResponse }>(
    "/api/tasks",
    {
      method: "POST",
      headers: { "X-User-Id": input.createdById },
      body: JSON.stringify(input),
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
    `/api/tasks/${taskId}`,
    {
      method: "PATCH",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ status }),
    }
  );
  return res.task;
}

export async function addTaskComment(
  taskId: string,
  content: string,
  userId: string
): Promise<CommentResponse> {
  const res = await apiFetch<{ comment: CommentResponse }>(
    `/api/tasks/${taskId}/comments`,
    {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ content }),
    }
  );
  return res.comment;
}
