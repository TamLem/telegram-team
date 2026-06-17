import type { BotContext } from "./context.js";

export type Middleware = (
  ctx: BotContext,
  next: () => Promise<void>
) => Promise<void>;

export function composeMiddleware(middlewares: Middleware[]) {
  return async (ctx: BotContext): Promise<void> => {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;

      if (i < middlewares.length) {
        const middleware = middlewares[i];
        await middleware(ctx, () => dispatch(i + 1));
      }
    };

    await dispatch(0);
  };
}
