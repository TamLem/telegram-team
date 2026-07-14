import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getBoardSummary } from "../apiClient.js";
import {
  buildBlockedTasksButton,
  buildBoardButton,
} from "../telegram/miniAppButtons.js";
import { escapeHtml } from "../telegram/html.js";
import {
  loadUserTeams,
  resolveCommandTeam,
  appendSwitchRow,
} from "../teamContext.js";

export async function blockedCommand(
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
      "You need to create or join a team before viewing blocked tasks.\n\nUse /start to get started."
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
  const params = {
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  };

  if (summary.blocked === 0) {
    let keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[buildBoardButton(params)]],
    };
    keyboard = appendSwitchRow(keyboard, "blocked", teams.length > 1);
    await ctx.reply(
      `<b>Blocked Tasks: 0</b> · ${escapeHtml(team.name)}\n\nNo blocked tasks. The team is moving.\n\nOpen the board to view all tasks.`,
      { reply_markup: keyboard }
    );
    return;
  }

  const lines: string[] = [
    `<b>Blocked Tasks: ${summary.blocked}</b> · ${escapeHtml(team.name)}`,
    "",
  ];

  for (const task of summary.topBlockedTasks.slice(0, 5)) {
    const assignee = task.assigneeName
      ? ` — @${escapeHtml(task.assigneeName)}`
      : " — Unassigned";
    lines.push(`${escapeHtml(task.title)}${assignee}`);
  }

  lines.push("\nOpen the board to review blockers.");

  let keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[buildBlockedTasksButton(params)]],
  };
  keyboard = appendSwitchRow(keyboard, "blocked", teams.length > 1);

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
