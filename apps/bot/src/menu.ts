import type { ReplyKeyboardMarkup } from "@telegram-team/bot-engine";
import type { BotContext } from "@telegram-team/bot-engine";
import { myTasksCommand } from "./commands/mytasks.js";
import { boardCommand } from "./commands/board.js";
import { blockedCommand } from "./commands/blocked.js";
import { newTaskCommand } from "./commands/newtask.js";

export const MAIN_MENU_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: "My Tasks" }, { text: "New Task" }],
    [{ text: "Board" }, { text: "Blocked" }],
  ],
  resize_keyboard: true,
};

export const NO_TEAM_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: "Create Team" }, { text: "Join Team" }],
    [{ text: "Help" }],
  ],
  resize_keyboard: true,
};

type MenuHandler = (ctx: BotContext) => Promise<void>;
const MENU_ACTIONS: Record<string, MenuHandler> = {
  "My Tasks": myTasksCommand,
  "New Task": newTaskCommand,
  "Board": boardCommand,
  "Blocked": blockedCommand,
};

export async function menuMessageHandler(ctx: BotContext): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) return;

  const handler = MENU_ACTIONS[text];
  if (handler) {
    await handler(ctx);
  }
}
