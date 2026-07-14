import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { syncUser, getTaskForUser } from "../apiClient.js";
import { miniAppContextUrl } from "../telegram/webApp.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function taskCallback(
  ctx: BotContext,
  _match: RegExpMatchArray | null
): Promise<void> {
  const data = ctx.callbackData;
  if (!data) {
    await ctx.answerCallbackQuery("Unsupported task action");
    return;
  }

  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const parts = data.split(":");
  const action = parts[1];
  const taskId = parts[2];

  if (!taskId) {
    await ctx.answerCallbackQuery("Unsupported task action");
    return;
  }

  if (action === "open") {
    const apiUser = await syncUser(from);
    const task = await getTaskForUser(taskId, apiUser.id);
    if (!task) {
      await ctx.answerCallbackQuery("Task not found");
      return;
    }
    const url = miniAppContextUrl(MINIAPP_BASE_URL, {
      action: "view_task",
      telegramUserId: from.id,
      teamId: task.teamId,
      returnChatId: chatId,
      taskId,
    });
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[{ text: "Open Task", web_app: { url } }]],
    };
    await ctx.reply("Tap below to open this task:", {
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery("Unsupported task action");
}
