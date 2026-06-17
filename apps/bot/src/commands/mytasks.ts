import type { BotContext } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function myTasksCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

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

  const { teams } = (await teamsRes.json()) as { teams: Array<{ id: string; name: string; role: string }> };

  if (!teams || teams.length === 0) {
    await ctx.reply(
      "You need to join or create a team first. Use /start to get started."
    );
    return;
  }

  const activeTeamId = ctx.getState<string>("activeTeamId") ?? teams[0].id;

  const tasksRes = await fetch(`${API_BASE_URL}/api/tasks?assigneeId=${apiUser.id}&teamId=${activeTeamId}&limit=10`, {
    headers: { "X-User-Id": apiUser.id },
  });

  const { tasks } = (await tasksRes.json()) as {
    tasks: Array<{ id: string; title: string; status: string; priority: string }>;
  };

  if (!tasks || tasks.length === 0) {
    await ctx.reply("You have no tasks yet. Use /newtask to create one.");
    return;
  }

  const statusIcons: Record<string, string> = {
    todo: "○",
    in_progress: "◔",
    done: "✓",
    cancelled: "✗",
  };

  const lines = tasks.map((task) => {
    const icon = statusIcons[task.status] ?? "○";
    return `${icon} <a href="${MINIAPP_BASE_URL}/app/tasks/${task.id}">${task.title}</a>`;
  });

  await ctx.reply(`<b>Your Tasks</b>\n\n${lines.join("\n")}`);
}
