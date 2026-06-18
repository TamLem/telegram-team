import type { BotContext } from "./context.js";

export type CommandHandler = (ctx: BotContext) => Promise<void>;

export class CommandRouter {
  private commands = new Map<string, CommandHandler>();
  private botUsername: string | null = null;

  setBotUsername(username: string | null | undefined): void {
    this.botUsername = username ? username.toLowerCase() : null;
  }

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
    const [commandName, targetUsername] = commandStr.split("@");

    if (
      targetUsername &&
      (!this.botUsername || targetUsername.toLowerCase() !== this.botUsername)
    ) {
      return false;
    }

    const handler = this.commands.get(commandName);
    if (!handler) return false;

    await handler(ctx);
    return true;
  }
}
