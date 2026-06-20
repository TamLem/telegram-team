import type { BotContext } from "@telegram-team/bot-engine";
import { MAIN_MENU_KEYBOARD } from "../menu.js";

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `<b>TaskPilot Help</b>\n\n` +
      `Use the menu buttons below to navigate:\n` +
      `• 📋 My Tasks — view your assigned tasks\n` +
      `• 📊 Board — open the task board\n` +
      `• 🚫 Blocked — see blocked tasks\n` +
      `• ✨ New Task — create a task\n` +
      `• 👥 Team — manage your team\n` +
      `• 👤 Members — view team members\n\n` +
      `You can also use /start to sync your account.`,
    { reply_markup: MAIN_MENU_KEYBOARD }
  );
}
