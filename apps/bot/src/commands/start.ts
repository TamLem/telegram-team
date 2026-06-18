import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { syncUser, getActiveTeams } from "../apiClient.js";
import { miniAppContextUrl } from "../telegram/webApp.js";
import { escapeHtml } from "../telegram/html.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function startCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);
  const teams = await getActiveTeams(apiUser.id);

  if (teams.length === 0) {
    const firstName = escapeHtml(from.first_name);

    const createTeamUrl = miniAppContextUrl(MINIAPP_BASE_URL, {
      action: "onboard_create_team",
      telegramUserId: from.id,
      returnChatId: chatId,
    });

    const joinTeamUrl = miniAppContextUrl(MINIAPP_BASE_URL, {
      action: "onboard_join_team",
      telegramUserId: from.id,
      returnChatId: chatId,
    });

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: "Create Team", web_app: { url: createTeamUrl } }],
        [{ text: "Join Team", web_app: { url: joinTeamUrl } }],
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

  const myTasksUrl = miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "view_my_tasks",
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  });

  const boardUrl = miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "view_board",
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  });

  const newTaskUrl = miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "create_task",
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  });

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "New Task", web_app: { url: newTaskUrl } },
        { text: "My Tasks", web_app: { url: myTasksUrl } },
      ],
      [{ text: "Open Board", web_app: { url: boardUrl } }],
    ],
  };

  await ctx.reply(
    `Welcome back! 👋\n\n` +
      `<b>Your teams:</b>\n${teamList}\n\n` +
      `Use the buttons below or the commands /newtask, /mytasks, /board.`,
    { reply_markup: keyboard }
  );
}
