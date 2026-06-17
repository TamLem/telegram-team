import type { BotContext } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { InlineKeyboardMarkup } from "@telegram-team/bot-engine";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function newTaskCommand(ctx: BotContext): Promise<void> {
  const args = ctx.getState<string>("args");

  if (!args || args.trim().length === 0) {
    await ctx.reply(
      "Usage: <code>/newtask &lt;title&gt;</code>\n\nExample:\n/newtask Prepare quarterly report"
    );
    return;
  }

  const title = args.trim();

  const user = ctx.from;
  if (!user) return;

  // Ensure user exists in the API by upserting
  const userRes = await fetch(`${API_BASE_URL}/api/users/telegram/${user.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: user.id,
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      username: user.username ?? null,
    }),
  });

  const userData = (await userRes.json()) as { user: { id: string } };

  // Create the task
  const taskRes = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      createdById: userData.user.id,
    }),
  });

  if (!taskRes.ok) {
    const err = (await taskRes.json()) as { error: string };
    await ctx.reply(`Failed to create task: ${err.error}`);
    return;
  }

  const { task } = (await taskRes.json()) as {
    task: { id: string; title: string; status: string; priority: string };
  };

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
        {
          text: "Mark Done",
          callback_data: `task:done:${task.id}`,
        },
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
