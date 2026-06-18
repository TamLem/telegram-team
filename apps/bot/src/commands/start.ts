import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getActiveTeams } from "../apiClient.js";
import { escapeHtml } from "../telegram/html.js";
import {
  buildCreateTaskButton,
  buildMyTasksButton,
  buildBoardButton,
  buildCreateTeamButton,
  buildJoinTeamButton,
} from "../telegram/miniAppButtons.js";

export async function startCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);
  const teams = await getActiveTeams(apiUser.id);

  if (teams.length === 0) {
    const firstName = escapeHtml(from.first_name);
    const params = { telegramUserId: from.id, returnChatId: chatId };

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [buildCreateTeamButton(params)],
        [buildJoinTeamButton(params)],
      ],
    };

    await ctx.reply(
      `Welcome to <b>TaskPilot</b>, ${firstName}!\n\n` +
        `To start, create a team or join an existing team.`,
      { reply_markup: keyboard }
    );
    return;
  }

  const team = teams[0];
  const teamList = teams.map((t) => `  • ${escapeHtml(t.name)}`).join("\n");
  const params = {
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  };

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        buildCreateTaskButton(params),
        buildMyTasksButton(params),
      ],
      [buildBoardButton(params)],
    ],
  };

  await ctx.reply(
    `Welcome back! 👋\n\n` +
      `<b>Your teams:</b>\n${teamList}\n\n` +
      `Use the buttons below or the commands /newtask, /mytasks, /board.`,
    { reply_markup: keyboard }
  );
}
