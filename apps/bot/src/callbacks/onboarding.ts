import type { BotContext } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { syncUser, getActiveTeams } from "../apiClient.js";
import { miniAppContextUrl } from "../telegram/webApp.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function onboardingCallback(
  ctx: BotContext,
  _match: RegExpMatchArray | null
): Promise<void> {
  const data = ctx.callbackData;
  if (!data) return;

  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const [, action] = data.split(":");

  if (action === "newtask") {
    const apiUser = await syncUser(from);
    const { teams, preferredTeamId } = await getActiveTeams(apiUser.id);
    if (teams.length === 0) {
      await ctx.answerCallbackQuery("Create a team first.");
      return;
    }
    const team =
      teams.find((t) => t.id === preferredTeamId) ?? teams[0];
    const url = miniAppContextUrl(MINIAPP_BASE_URL, {
      action: "create_task",
      telegramUserId: from.id,
      teamId: team.id,
      returnChatId: chatId,
    });
    await ctx.reply("Tap below to create a task:", {
      reply_markup: {
        inline_keyboard: [[{ text: "Open Task Form", web_app: { url } }]],
      },
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "board") {
    const apiUser = await syncUser(from);
    const { teams, preferredTeamId } = await getActiveTeams(apiUser.id);
    if (teams.length > 0) {
      const team =
        teams.find((t) => t.id === preferredTeamId) ?? teams[0];
      const url = miniAppContextUrl(MINIAPP_BASE_URL, {
        action: "view_board",
        telegramUserId: from.id,
        teamId: team.id,
        returnChatId: chatId,
      });
      await ctx.reply("Tap below to open the board:", {
        reply_markup: {
          inline_keyboard: [[{ text: "Open Kanban Board", web_app: { url } }]],
        },
      });
    }
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery();
}
