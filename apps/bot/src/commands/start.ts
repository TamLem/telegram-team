import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { setUserState } from "../callbacks/onboarding.js";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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

async function syncUser(user: { id: number; first_name: string; last_name?: string; username?: string }) {
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

async function getActiveTeams(userId: string) {
  try {
    const { teams } = await apiFetch<{ teams: Array<{ id: string; name: string; inviteCode: string; role: string }> }>(
      `/api/me/teams`,
      { headers: { "X-User-Id": userId } }
    );
    return teams;
  } catch {
    return [];
  }
}

const ONBOARDING_KEYBOARD: InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "Create Team", callback_data: "onboard:create" }],
    [{ text: "Join Team", callback_data: "onboard:join" }],
  ],
};

export async function startCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);

  const teams = await getActiveTeams(apiUser.id);

  setUserState(chatId, "apiUserId", apiUser.id);

  if (teams.length === 0) {
    const firstName = from.first_name;

    await ctx.reply(
      `Welcome to <b>TaskPilot</b>, ${firstName}!\n\n` +
        `To start, create a team or join an existing team.`,
      { reply_markup: ONBOARDING_KEYBOARD }
    );
    return;
  }

  setUserState(chatId, "activeTeamId", teams[0].id);

  const teamList = teams.map((t) => `  • ${t.name}`).join("\n");

  await ctx.reply(
    `Welcome back! 👋\n\n` +
      `<b>Your teams:</b>\n${teamList}\n\n` +
      `Use /newtask to create a task, /mytasks to see your work, or /board to open the Kanban board.`
  );
}
