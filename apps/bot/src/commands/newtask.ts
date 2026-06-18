import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getActiveTeams } from "../apiClient.js";
import { buildCreateTaskButton } from "../telegram/miniAppButtons.js";

export async function newTaskCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);
  const teams = await getActiveTeams(apiUser.id);

  if (teams.length === 0) {
    await ctx.reply(
      "You need to create or join a team before using tasks.\n\nUse /start to get started."
    );
    return;
  }

  const team = teams[0];
  const buttonParams = {
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  };

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[buildCreateTaskButton(buttonParams)]],
  };

  const args = ctx.getState<string>("args")?.trim();
  if (args && args.length > 0) {
    await ctx.reply(
      "Task creation uses the Mini App form.",
      { reply_markup: keyboard }
    );
    return;
  }

  await ctx.reply(
    "Create a new task using the Mini App form.",
    { reply_markup: keyboard }
  );
}
