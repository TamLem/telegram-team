import type { BotContext } from "./context.js";
import type { TelegramUpdate } from "./types.js";
import type { Middleware } from "./middleware.js";
import { composeMiddleware } from "./middleware.js";
import { TelegramApi } from "./api.js";
import { CommandRouter, type CommandHandler } from "./router.js";
import { CallbackRouter, type CallbackHandler } from "./callbacks.js";
import { BotContext as Context } from "./context.js";

export type MessageHandler = (ctx: BotContext) => Promise<void>;
export type ErrorHandler = (error: Error, ctx: BotContext) => Promise<void>;

export class Bot {
  token: string;
  api: TelegramApi;

  private middlewares: Middleware[] = [];
  private commandRouter = new CommandRouter();
  private callbackRouter = new CallbackRouter();
  private messageHandlers: MessageHandler[] = [];
  private errorHandler: ErrorHandler | null = null;
  private composedMiddleware: ((ctx: BotContext) => Promise<void>) | null =
    null;

  constructor(token: string) {
    this.token = token;
    this.api = new TelegramApi(token);
  }

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    this.composedMiddleware = null;
    return this;
  }

  command(name: string, handler: CommandHandler): this {
    this.commandRouter.add(name, handler);
    return this;
  }

  callback(pattern: string | RegExp, handler: CallbackHandler): this {
    this.callbackRouter.add(pattern, handler);
    return this;
  }

  message(handler: MessageHandler): this {
    this.messageHandlers.push(handler);
    return this;
  }

  onError(handler: ErrorHandler): this {
    this.errorHandler = handler;
    return this;
  }

  private getRunner(): (ctx: BotContext) => Promise<void> {
    if (!this.composedMiddleware) {
      this.composedMiddleware = composeMiddleware(this.middlewares);
    }
    return this.composedMiddleware;
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const ctx = new Context(update, this);

    try {
      const run = this.getRunner();
      await run(ctx);

      if (ctx.callbackQuery) {
        const handled = await this.callbackRouter.handle(ctx);
        if (!handled) {
          await this.runMessageHandlers(ctx);
        }
      } else if (ctx.message || ctx.text) {
        const handled = await this.commandRouter.handle(ctx);
        if (!handled) {
          await this.runMessageHandlers(ctx);
        }
      }
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler(error as Error, ctx);
      } else {
        console.error("Unhandled bot error:", error);
      }
    }
  }

  private async runMessageHandlers(ctx: BotContext): Promise<void> {
    for (const handler of this.messageHandlers) {
      await handler(ctx);
    }
  }

  async setWebhook(url: string, secretToken?: string): Promise<true> {
    return this.api.setWebhook(url, secretToken);
  }
}

export function createBot(token: string): Bot {
  return new Bot(token);
}
