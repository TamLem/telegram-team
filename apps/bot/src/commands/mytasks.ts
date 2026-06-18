import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getActiveTeams, getMyTaskSummary, getBoardSummary } from "../apiClient.js";
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
      "You need to create or join a team before viewing your tasks.\n\nUse /start to get started."
    );
    return;
  }

  const team = teams[0];
  const summary = await getMyTaskSummary(team.id, apiUser.id);
  const boardSummary = await getBoardSummary(team.id, apiUser.id);

  if (summary.total === 0) {
    const params = {
      telegramUserId: from.id,
      teamId: team.id,
      returnChatId: chatId,
    };
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [buildCreateTaskButton(params)],
        [buildBoardButton(params)],
      ],
    };
    await ctx.reply(
      "You have no assigned tasks.",
      { reply_markup: keyboard }
    );
    return;
  }

  const lines: string[] = [
    `<b>Your Tasks</b>`,
    "",
    `Todo: ${summary.todo}`,
    `Doing: ${summary.doing}`,
    `Blocked: ${summary.blocked}`,
    `Done: ${summary.done}`,
  ];

  if (boardSummary.dueSoon > 0) {
    lines.push(`\nDue Soon: ${boardSummary.dueSoon}`);
  }

  const totalActive = summary.todo + summary.doing + summary.blocked;
  lines.push(`\nActive: ${totalActive}`);

  const params = {
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  };

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[buildMyTasksButton(params)]],
  };

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
