import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { getUserState, setUserState } from "../callbacks/onboarding.js";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

async function syncUser(user: { id: number; first_name: string; last_name?: string; username?: string }) {
  const res = await fetch(`${API_BASE_URL}/api/users/telegram/${user.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramUserId: user.id,
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      telegramUsername: user.username ?? null,
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to sync user: ${res.status}`);
  }
  const { user: apiUser } = (await res.json()) as { user: { id: string } };
  return apiUser;
}

async function getActiveTeams(userId: string) {
  const res = await fetch(`${API_BASE_URL}/api/me/teams`, {
    headers: { "X-User-Id": userId },
  });
  if (!res.ok) return [];
  const { teams } = (await res.json()) as { teams: Array<{ id: string; name: string; role: string }> };
  return teams;
}

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
  doing: "Doing",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

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

  const res = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": apiUser.id,
      "X-Team-Id": activeTeamId,
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    await ctx.reply(`Failed to create task: ${err.error ?? "Unknown error"}`);
    return;
  }

  const { task } = (await res.json()) as {
    task: {
      id: string;
      title: string;
      status: string;
      priority: string;
      assignedToUserId: string | null;
      dueAt: string | null;
    };
  };

  const taskUrl = `${MINIAPP_BASE_URL}/app/tasks/${task.id}`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "Doing", callback_data: `task:status:doing:${task.id}` },
        { text: "Blocked", callback_data: `task:status:blocked:${task.id}` },
        { text: "Done", callback_data: `task:status:done:${task.id}` },
      ],
      [{ text: "Open Details", web_app: { url: taskUrl } }],
    ],
  };

  const status = STATUS_LABELS[task.status] ?? task.status;
  const priority = PRIORITY_LABELS[task.priority] ?? task.priority;

  await ctx.reply(
    `<b>Task Created</b>\n\n` +
      `<b>Title:</b> ${task.title}\n` +
      `<b>Status:</b> ${status}\n` +
      `<b>Priority:</b> ${priority}\n`,
    { reply_markup: keyboard }
  );
}
