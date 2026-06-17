import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { getUserState, setUserState } from "../callbacks/onboarding.js";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

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

export async function newTaskCommand(ctx: BotContext): Promise<void> {
  const args = ctx.getState<string>("args");

  if (!args || args.trim().length === 0) {
    await ctx.reply(
      "Usage: <code>/newtask &lt;title&gt;</code>\n\nExample:\n/newtask Prepare quarterly report"
    );
    return;
  }

  const title = args.trim();
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);

  const teams = await getActiveTeams(apiUser.id);

  if (teams.length === 0) {
    await ctx.reply(
      "You need to join or create a team first. Use /start to get started."
    );
    return;
  }

  const activeTeamId = getUserState(chatId, "activeTeamId") ?? teams[0].id;
  setUserState(chatId, "activeTeamId", activeTeamId);

  const { task } = await apiFetch<{ task: { id: string; title: string; status: string; priority: string } }>(
    "/api/tasks",
    {
      method: "POST",
      headers: { "X-User-Id": apiUser.id },
      body: JSON.stringify({
        title,
        teamId: activeTeamId,
      }),
    }
  );

  const taskUrl = `${MINIAPP_BASE_URL}/app/tasks/${task.id}`;

  const statusLabel =
    task.status === "todo"
      ? "To Do"
      : task.status === "in_progress"
        ? "In Progress"
        : task.status === "done"
          ? "Done"
          : task.status;

  const priorityLabel =
    task.priority === "urgent"
      ? "Urgent"
      : task.priority === "high"
        ? "High"
        : task.priority === "medium"
          ? "Medium"
          : "Low";

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "View Task", url: taskUrl },
        { text: "Mark Done", callback_data: `task:done:${task.id}` },
      ],
    ],
  };

  await ctx.reply(
    `<b>Task Created</b>\n\n` +
      `<b>Title:</b> ${task.title}\n` +
      `<b>Status:</b> ${statusLabel}\n` +
      `<b>Priority:</b> ${priorityLabel}\n`,
    { reply_markup: keyboard }
  );
}
