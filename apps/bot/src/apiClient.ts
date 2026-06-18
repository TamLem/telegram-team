import { getEnv } from "@telegram-team/config";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");

export async function apiFetch<T>(
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
  } catch {
    return [];
  }
}
