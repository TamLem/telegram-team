import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser } from "../apiClient.js";
import {
  buildOpenTeamButton,
  buildOpenMembersButton,
  buildBoardButton,
  buildCreateTeamButton,
  buildJoinTeamButton,
} from "../telegram/miniAppButtons.js";
import { escapeHtml } from "../telegram/html.js";
import {
  loadUserTeams,
  resolveCommandTeam,
  appendSwitchRow,
} from "../teamContext.js";

export async function teamCommand(
  ctx: BotContext,
  options?: { teamId?: string }
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);
  const { teams, preferredTeamId } = await loadUserTeams(apiUser.id);

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

  const team =
    (options?.teamId
      ? teams.find((t) => t.id === options.teamId)
      : null) ?? resolveCommandTeam(teams, preferredTeamId);

  if (!team) {
    await ctx.reply("No team available.");
    return;
  }

  const params = {
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  };
  const onboardParams = {
    telegramUserId: from.id,
    returnChatId: chatId,
  };
  let keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [buildOpenTeamButton(params)],
      [buildOpenMembersButton(params)],
      [buildBoardButton(params)],
      [buildCreateTeamButton(onboardParams), buildJoinTeamButton(onboardParams)],
    ],
  };
  keyboard = appendSwitchRow(keyboard, "team", teams.length > 1);

  await ctx.reply(
    `<b>${escapeHtml(team.name)}</b>\n\nOpen your team workspace, or create/join another team.`,
    { reply_markup: keyboard }
  );
}
