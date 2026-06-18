import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { syncUser, getActiveTeams } from "../apiClient.js";
import { miniAppContextUrl } from "../telegram/webApp.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function boardCommand(ctx: BotContext): Promise<void> {
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

  const team = teams[0];

  const url = miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "view_board",
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  });

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: "Open Kanban Board", web_app: { url } }]],
  };

  await ctx.reply("Tap below to open the task board:", {
    reply_markup: keyboard,
  });
}
