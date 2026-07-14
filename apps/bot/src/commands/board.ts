import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getBoardSummary } from "../apiClient.js";
import { buildBoardButton } from "../telegram/miniAppButtons.js";
import { escapeHtml } from "../telegram/html.js";
import {
  loadUserTeams,
  resolveCommandTeam,
  appendSwitchRow,
} from "../teamContext.js";

export async function boardCommand(
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
      "You need to create or join a team before viewing the board.\n\nUse /start to get started."
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

  const summary = await getBoardSummary(team.id, apiUser.id);

  const lines: string[] = [
    `<b>Team Board: ${escapeHtml(team.name)}</b>`,
    "",
    `Todo: ${summary.todo}`,
    `Doing: ${summary.doing}`,
    `Blocked: ${summary.blocked}`,
    `Done: ${summary.done}`,
  ];

  if (summary.dueSoon > 0) {
    lines.push(`\nDue Soon: ${summary.dueSoon}`);
  }
  if (summary.overdue > 0) {
    lines.push(`Overdue: ${summary.overdue}`);
  }
  if (summary.unassigned > 0) {
    lines.push(`Unassigned: ${summary.unassigned}`);
  }

  lines.push("\nOpen the board to view and manage tasks.");

  const params = {
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  };

  let keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[buildBoardButton(params)]],
  };
  keyboard = appendSwitchRow(keyboard, "board", teams.length > 1);

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
