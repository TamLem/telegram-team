import type { BotContext } from "./context.js";

export type CommandHandler = (ctx: BotContext) => Promise<void>;

export class CommandRouter {
  private commands = new Map<string, CommandHandler>();

  add(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler);
  }

  async handle(ctx: BotContext): Promise<boolean> {
    const text = ctx.text;
    if (!text) return false;

    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) return false;

    const parts = trimmed.split(/\s+/);
    const commandStr = parts[0];
    const commandName = commandStr.split("@")[0];

    const handler = this.commands.get(commandName);
    if (!handler) return false;

    await handler(ctx);
    return true;
  }
}
