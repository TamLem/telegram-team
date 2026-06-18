import type { BotContext } from "@telegram-team/bot-engine";

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `<b>Commands</b>\n\n` +
      `/start — Sign in and view your teams\n` +
      `/newtask — Create a new task\n` +
      `/mytasks — View your tasks\n` +
      `/board — Open the task board\n` +
      `/team — Open your team workspace\n` +
      `/members — View team members\n` +
      `/invite — Get team invite code\n` +
      `/help — Show this message\n`
  );
}
