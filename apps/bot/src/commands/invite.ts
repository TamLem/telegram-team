import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getActiveTeams } from "../apiClient.js";
import {
  buildOpenInviteButton,
  buildCreateTeamButton,
  buildJoinTeamButton,
} from "../telegram/miniAppButtons.js";

export async function inviteCommand(ctx: BotContext): Promise<void> {
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
    inline_keyboard: [[buildOpenInviteButton(params)]],
  };

  await ctx.reply("Open the invite page to share your team code.", { reply_markup: keyboard });
}
