import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { getUserState } from "../callbacks/onboarding.js";
import { miniAppLaunchUrl } from "../telegram/webApp.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");
const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");

export async function boardCommand(ctx: BotContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const userRes = await fetch(`${API_BASE_URL}/api/users/telegram/${from.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramUserId: from.id,
      firstName: from.first_name,
      lastName: from.last_name ?? null,
      telegramUsername: from.username ?? null,
    }),
  });

  if (!userRes.ok) {
    await ctx.reply("Something went wrong. Please try again.");
    return;
  }

  const { user: apiUser } = (await userRes.json()) as { user: { id: string } };

  const teamsRes = await fetch(`${API_BASE_URL}/api/me/teams`, {
    headers: { "X-User-Id": apiUser.id },
  });

  if (!teamsRes.ok) {
    await ctx.reply("Something went wrong. Please try again.");
    return;
  }

  const { teams } = (await teamsRes.json()) as { teams: Array<{ id: string; name: string; role: string }> };

  if (!teams || teams.length === 0) {
    await ctx.reply(
      "You need to join or create a team first. Use /start to get started."
    );
    return;
  }

  const activeTeamId = getUserState(chatId, "activeTeamId") ?? teams[0].id;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: "Open Kanban Board",
          web_app: { url: miniAppLaunchUrl(MINIAPP_BASE_URL, `/app/board/${activeTeamId}`) },
        },
      ],
    ],
  };

  await ctx.reply("Tap below to open the task board in the Telegram Mini App:", {
    reply_markup: keyboard,
  });
}
