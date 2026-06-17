import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { getUserState } from "../callbacks/onboarding.js";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function myTasksCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const userRes = await fetch(`${API_BASE_URL}/api/users/telegram/${from.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramUserId: from.id,
      firstName: from.first_name,
      lastName: from.last_name ?? null,
      telegramUsername: from.username ?? null,
    }),
  });

  if (!userRes.ok) {
    await ctx.reply("Something went wrong. Please try again.");
    return;
  }

  const { user: apiUser } = (await userRes.json()) as { user: { id: string } };

  const teamsRes = await fetch(`${API_BASE_URL}/api/me/teams`, {
    headers: { "X-User-Id": apiUser.id },
  });

  if (!teamsRes.ok) {
    await ctx.reply("Something went wrong. Please try again.");
    return;
  }

  const { teams } = (await teamsRes.json()) as {
    teams: Array<{ id: string; name: string; role: string }>;
  };

  if (!teams || teams.length === 0) {
    await ctx.reply(
      "You need to join or create a team first. Use /start to get started."
    );
    return;
  }

  const activeTeamId = getUserState(chatId, "activeTeamId") ?? teams[0].id;

  const tasksRes = await fetch(
    `${API_BASE_URL}/api/tasks?assigned_to=me&team_id=${activeTeamId}&limit=10`,
    { headers: { "X-User-Id": apiUser.id } }
  );

  const { tasks } = (await tasksRes.json()) as {
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      assignedToUserId: string | null;
      dueAt: string | null;
    }>;
  };

  if (!tasks || tasks.length === 0) {
    await ctx.reply("You have no tasks yet. Use /newtask to create one.");
    return;
  }

  for (const task of tasks) {
    const statusIcons: Record<string, string> = {
      todo: "○",
      doing: "◔",
      blocked: "⊘",
      done: "✓",
      cancelled: "✗",
    };

    const icon = statusIcons[task.status] ?? "○";

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          ...(task.status === "todo"
            ? [{ text: "Doing", callback_data: `task:status:doing:${task.id}` }]
            : []),
          ...(task.status === "todo" || task.status === "doing"
            ? [{ text: "Blocked", callback_data: `task:status:blocked:${task.id}` }]
            : []),
          ...(task.status !== "done" && task.status !== "cancelled"
            ? [{ text: "Done", callback_data: `task:status:done:${task.id}` }]
            : []),
        ],
        [
          { text: "Open Details", web_app: { url: `${MINIAPP_BASE_URL}/app/tasks/${task.id}` } },
        ],
      ].filter((row) => row.length > 0),
    };

    await ctx.reply(
      `${icon} <b>${task.title}</b>\n` +
        `Status: ${task.status} | Priority: ${task.priority}`,
      { reply_markup: keyboard }
    );
  }
}
