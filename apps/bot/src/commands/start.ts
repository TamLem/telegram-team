import type { BotContext } from "@telegram-team/bot-engine";

export async function startCommand(ctx: BotContext): Promise<void> {
  const firstName = ctx.from?.first_name ?? "there";

  await ctx.reply(
    `Welcome, <b>${firstName}</b>!\n\n` +
      `I'm your team task manager. Here's what I can do:\n\n` +
      `/newtask &lt;title&gt; — Create a new task\n` +
      `/mytasks — View your assigned tasks\n` +
      `/board — Open the Kanban board\n` +
      `/help — Show this help message`
  );
}
