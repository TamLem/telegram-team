import type { BotContext } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";

export async function helpCommand(ctx: BotContext): Promise<void> {
  const miniAppUrl = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

  await ctx.reply(
    `<b>Commands</b>\n\n` +
      `/start — Sign in and view your teams\n` +
      `/newtask &lt;title&gt; — Create a new task\n` +
      `/mytasks — View your tasks\n` +
      `/board — Open the task board\n` +
      `/help — Show this message\n\n` +
      `<b>Quick actions</b>\n\n` +
      `Open the Mini App for the full experience:\n` +
      `<a href="${miniAppUrl}/app/tasks/mine">My Tasks</a>`
  );
}
