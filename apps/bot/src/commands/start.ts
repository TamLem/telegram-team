import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { syncUser, getActiveTeams } from "../apiClient.js";
import { escapeHtml } from "../telegram/html.js";
import {
  buildCreateTeamButton,
  buildJoinTeamButton,
} from "../telegram/miniAppButtons.js";
import { miniAppRootUrl } from "../telegram/webApp.js";
import { MAIN_MENU_KEYBOARD } from "../menu.js";

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
    const params = { telegramUserId: from.id, returnChatId: chatId };

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [buildCreateTeamButton(params)],
        [buildJoinTeamButton(params)],
      ],
    };

    // Keep the standalone Mini App available before onboarding is complete.
    try {
      await ctx.setChatMenuButton({
        chat_id: chatId,
        menu_button: {
          type: "web_app",
          text: "Open TaskPilot",
          web_app: { url: miniAppRootUrl(MINIAPP_BASE_URL) },
        },
      });
    } catch {}

    await ctx.reply(
      `Welcome to <b>TaskPilot</b>, ${firstName}!\n\n` +
        `To start, create a team or join an existing one.\n\n` +
        `Once you have a team, you'll get a quick-access menu.`,
      { reply_markup: keyboard }
    );
    return;
  }

  const teamList = teams.map((t) => `  • ${escapeHtml(t.name)}`).join("\n");

  // The persistent menu opens the standalone Mini App. Signed context is
  // reserved for action-specific notification buttons.
  const miniAppUrl = miniAppRootUrl(MINIAPP_BASE_URL);

  try {
    await ctx.setChatMenuButton({
      chat_id: chatId,
      menu_button: {
        type: "web_app",
        text: "Open Tasks",
        web_app: { url: miniAppUrl },
      },
    });
  } catch {}

  await ctx.reply(
    `Welcome back! 👋\n\n` +
      `<b>Your teams:</b>\n${teamList}\n\n` +
      `Use the button below ⤵ or the keyboard menu for quick access.`,
    { reply_markup: MAIN_MENU_KEYBOARD }
  );
}
