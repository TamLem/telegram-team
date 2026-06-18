import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getActiveTeams, getMyTaskSummary } from "../apiClient.js";
import { buildMyTasksButton, buildCreateTaskButton, buildBoardButton } from "../telegram/miniAppButtons.js";

export async function myTasksCommand(ctx: BotContext): Promise<void> {
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

  const summary = await getMyTaskSummary(team.id, apiUser.id);

  if (summary.total === 0) {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [buildCreateTaskButton(buttonParams)],
        [buildBoardButton(buttonParams)],
      ],
    };
    await ctx.reply(
      "You have no assigned tasks.",
      { reply_markup: keyboard }
    );
    return;
  }

  const lines = [
    "<b>My Tasks</b>\n",
    `Todo: ${summary.todo}`,
    `Doing: ${summary.doing}`,
    `Blocked: ${summary.blocked}`,
    `Done: ${summary.done}`,
    `\nOpen the Mini App to view and manage your tasks.`,
  ];

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[buildMyTasksButton(buttonParams)]],
  };

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
