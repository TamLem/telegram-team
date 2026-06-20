import type { ReplyKeyboardMarkup } from "@telegram-team/bot-engine";
import type { BotContext } from "@telegram-team/bot-engine";
import { myTasksCommand } from "./commands/mytasks.js";
import { boardCommand } from "./commands/board.js";
import { blockedCommand } from "./commands/blocked.js";
import { newTaskCommand } from "./commands/newtask.js";
import { teamCommand } from "./commands/team.js";
import { membersCommand } from "./commands/members.js";
import { inviteCommand } from "./commands/invite.js";

export const MAIN_MENU_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: "📋 My Tasks" }, { text: "📊 Board" }],
    [{ text: "🚫 Blocked" }, { text: "✨ New Task" }],
    [{ text: "👥 Team" }, { text: "👤 Members" }],
  ],
  resize_keyboard: true,
};

export const NO_TEAM_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: "🏗 Create Team" }, { text: "🔑 Join Team" }],
    [{ text: "ℹ️ Help" }],
  ],
  resize_keyboard: true,
};

type MenuHandler = (ctx: BotContext) => Promise<void>;
const MENU_ACTIONS: Record<string, MenuHandler> = {
  "📋 My Tasks": myTasksCommand,
  "📊 Board": boardCommand,
  "🚫 Blocked": blockedCommand,
  "✨ New Task": newTaskCommand,
  "👥 Team": teamCommand,
  "👤 Members": membersCommand,
  "🔑 Invite": inviteCommand,
};

export async function menuMessageHandler(ctx: BotContext): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) return;

  const handler = MENU_ACTIONS[text];
  if (handler) {
    await handler(ctx);
  }
}
