import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export async function boardCommand(ctx: BotContext): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: "Open Kanban Board",
          web_app: { url: `${MINIAPP_BASE_URL}/app/board/default` },
        },
      ],
    ],
  };

  await ctx.reply("Tap below to open the task board in the Telegram Mini App:", {
    reply_markup: keyboard,
  });
}
