import type { Bot, BotCommand } from "@telegram-team/bot-engine";
import { startCommand } from "./commands/start.js";
import { helpCommand } from "./commands/help.js";
import { newTaskCommand } from "./commands/newtask.js";
import { myTasksCommand } from "./commands/mytasks.js";
import { boardCommand } from "./commands/board.js";
import { blockedCommand } from "./commands/blocked.js";
import { teamCommand } from "./commands/team.js";
import { membersCommand } from "./commands/members.js";
import { inviteCommand } from "./commands/invite.js";
import { taskCallback } from "./callbacks/task.js";
import { onboardingCallback } from "./callbacks/onboarding.js";
import { teamSelectCallback } from "./callbacks/teamSelect.js";
import { menuMessageHandler } from "./menu.js";

export const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Sign in and show the menu" },
  { command: "help", description: "Show help and menu" },
];

export function registerBotInteractions(bot: Bot): void {
  bot.command("/start", startCommand);
  bot.command("/help", helpCommand);

  // Registered for /command text fallback, but not shown in menu
  bot.command("/newtask", newTaskCommand);
  bot.command("/mytasks", myTasksCommand);
  bot.command("/board", boardCommand);
  bot.command("/blocked", blockedCommand);
  bot.command("/team", teamCommand);
  bot.command("/members", membersCommand);
  bot.command("/invite", inviteCommand);

  // Menu keyboard button handler
  bot.message(menuMessageHandler);

  bot.callback(/^onboard:/, onboardingCallback);
  bot.callback(/^task:/, taskCallback);
  bot.callback(/^team:(select|switch):/, teamSelectCallback);
}
