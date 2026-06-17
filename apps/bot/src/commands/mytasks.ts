import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function myTasksCommand(ctx: BotContext): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  // Get user ID from the API
  const userRes = await fetch(
    `${API_BASE_URL}/api/users/telegram/${user.id}`
  );
  if (!userRes.ok) {
    await ctx.reply(
      "You haven't created any tasks yet. Use /newtask to get started."
    );
    return;
  }

  const { user: apiUser } = (await userRes.json()) as {
    user: { id: string };
  };

  const tasksRes = await fetch(
    `${API_BASE_URL}/api/tasks?assigneeId=${apiUser.id}&limit=10`
  );
  const { tasks } = (await tasksRes.json()) as {
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
    }>;
  };

  if (!tasks || tasks.length === 0) {
    await ctx.reply("You have no tasks. Use /newtask to create one.");
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
