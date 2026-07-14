import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import {
  syncUser,
  getCrossTeamTaskSummary,
} from "../apiClient.js";
import { escapeHtml } from "../telegram/html.js";
import { getEnv } from "@telegram-team/config";
import { miniAppContextUrl, miniAppRootUrl } from "../telegram/webApp.js";
import { loadUserTeams } from "../teamContext.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function myTasksCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);
  const { teams } = await loadUserTeams(apiUser.id);

  if (teams.length === 0) {
    await ctx.reply(
      "You need to create or join a team first.\n\nUse /start to get started."
    );
    return;
  }

  const summary = await getCrossTeamTaskSummary(apiUser.id);

  const lines: string[] = [
    `<b>My Tasks</b> (all teams)`,
    "",
    `Open: ${summary.todo + summary.doing + summary.blocked}`,
    `  Todo: ${summary.todo} · Doing: ${summary.doing} · Blocked: ${summary.blocked}`,
  ];

  if (summary.byTeam.length > 0) {
    lines.push("", "<b>By team</b>");
    for (const team of summary.byTeam) {
      lines.push(
        `• ${escapeHtml(team.teamName)}: ${team.total} open` +
          ` (todo ${team.todo}, doing ${team.doing}, blocked ${team.blocked})`
      );
    }
  }

  const openTasks = summary.tasks.slice(0, 5);
  if (openTasks.length > 0) {
    lines.push("", "<b>Recent open</b>");
    for (const task of openTasks) {
      const teamLabel = task.teamName
        ? ` · ${escapeHtml(task.teamName)}`
        : "";
      lines.push(
        `• ${escapeHtml(task.title)} (${task.status}${teamLabel})`
      );
    }
  }

  const myTasksUrl =
    teams.length === 1
      ? miniAppContextUrl(MINIAPP_BASE_URL, {
          action: "view_my_tasks",
          telegramUserId: from.id,
          teamId: teams[0].id,
          returnChatId: chatId,
        })
      : `${miniAppRootUrl(MINIAPP_BASE_URL)}/my-tasks`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "Open My Tasks", web_app: { url: myTasksUrl } }],
    ],
  };

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
