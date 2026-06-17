import type { BotContext } from "./context.js";

export type CallbackHandler = (
  ctx: BotContext,
  match: RegExpMatchArray | null
) => Promise<void>;

interface CallbackRoute {
  pattern: string | RegExp;
  handler: CallbackHandler;
}

export class CallbackRouter {
  private routes: CallbackRoute[] = [];

  add(pattern: string | RegExp, handler: CallbackHandler): void {
    this.routes.push({ pattern, handler });
  }

  async handle(ctx: BotContext): Promise<boolean> {
    const data = ctx.callbackData;
    if (!data) return false;

    for (const route of this.routes) {
      if (typeof route.pattern === "string") {
        if (data === route.pattern) {
          await route.handler(ctx, null);
          return true;
        }
      } else {
        const match = data.match(route.pattern);
        if (match) {
          await route.handler(ctx, match);
          return true;
        }
      }
    }

    return false;
  }
}
