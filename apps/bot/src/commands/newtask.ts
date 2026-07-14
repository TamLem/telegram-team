import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser } from "../apiClient.js";
import { buildCreateTaskButton } from "../telegram/miniAppButtons.js";
import { escapeHtml } from "../telegram/html.js";
import {
  loadUserTeams,
  resolveCommandTeam,
  appendSwitchRow,
} from "../teamContext.js";

export async function newTaskCommand(
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
    await ctx.reply(
      "You need to create or join a team before using tasks.\n\nUse /start to get started."
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

  const buttonParams = {
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  };

  let keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[buildCreateTaskButton(buttonParams)]],
  };
  keyboard = appendSwitchRow(keyboard, "newtask", teams.length > 1);

  await ctx.reply(
    `Create a new task in <b>${escapeHtml(team.name)}</b> using the Mini App form.`,
    { reply_markup: keyboard }
  );
}
