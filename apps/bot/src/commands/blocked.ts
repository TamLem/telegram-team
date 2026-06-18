import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, getActiveTeams, getBoardSummary } from "../apiClient.js";
import { buildBlockedTasksButton, buildBoardButton } from "../telegram/miniAppButtons.js";

export async function blockedCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);
  const teams = await getActiveTeams(apiUser.id);

  if (teams.length === 0) {
    await ctx.reply(
      "You need to create or join a team before viewing blocked tasks.\n\nUse /start to get started."
    );
    return;
  }

  const team = teams[0];
  const summary = await getBoardSummary(team.id, apiUser.id);

  if (summary.blocked === 0) {
    const params = {
      telegramUserId: from.id,
      teamId: team.id,
      returnChatId: chatId,
    };
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[buildBoardButton(params)]],
    };
    await ctx.reply(
      `<b>Blocked Tasks: 0</b>\n\nNo blocked tasks. The team is moving.\n\nOpen the board to view all tasks.`,
      { reply_markup: keyboard }
    );
    return;
  }

  const lines: string[] = [
    `<b>Blocked Tasks: ${summary.blocked}</b>`,
    "",
  ];

  for (const task of summary.topBlockedTasks.slice(0, 5)) {
    const assignee = task.assigneeName
      ? ` — @${task.assigneeName}`
      : " — Unassigned";
    lines.push(`${task.title}${assignee}`);
  }

  lines.push("\nOpen the board to review blockers.");

  const params = {
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  };

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[buildBlockedTasksButton(params)]],
  };

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
