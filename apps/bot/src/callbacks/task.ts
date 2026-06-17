import type { BotContext } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");

export async function taskCallback(
  ctx: BotContext,
  match: RegExpMatchArray | null
): Promise<void> {
  if (!match) return;

  const [, action, taskId] = match[0].split(":");

  if (action === "done" && taskId) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });

    if (!res.ok) {
      await ctx.answerCallbackQuery("Failed to update task");
      return;
    }

    const { task } = (await res.json()) as {
      task: { id: string; title: string; status: string; priority: string };
    };

    await ctx.editMessageText(
      `<b>Task Completed</b>\n\n` +
        `<b>Title:</b> ${task.title}\n` +
        `<b>Status:</b> Done ✓\n` +
        `<b>Priority:</b> ${task.priority}\n`
    );

    await ctx.answerCallbackQuery("Marked as done!");
  }
}
