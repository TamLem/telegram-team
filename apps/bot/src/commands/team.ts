import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getActiveTeams } from "../apiClient.js";
import {
  buildOpenTeamButton,
  buildOpenMembersButton,
  buildBoardButton,
  buildCreateTeamButton,
  buildJoinTeamButton,
} from "../telegram/miniAppButtons.js";

export async function teamCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);
  const teams = await getActiveTeams(apiUser.id);

  if (teams.length === 0) {
    const params = { telegramUserId: from.id, returnChatId: chatId };
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [buildCreateTeamButton(params)],
        [buildJoinTeamButton(params)],
      ],
    };
    await ctx.reply(
      "You're not in a team yet. Create or join one to get started.",
      { reply_markup: keyboard }
    );
    return;
  }

  const team = teams[0];
  const params = { telegramUserId: from.id, teamId: team.id, returnChatId: chatId };
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [buildOpenTeamButton(params)],
      [buildOpenMembersButton(params)],
      [buildBoardButton(params)],
    ],
  };

  await ctx.reply(`${team.name}\n\nOpen your team workspace.`, { reply_markup: keyboard });
}
