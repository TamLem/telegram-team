import type { Bot, BotCommand } from "@telegram-team/bot-engine";
import { startCommand } from "./commands/start.js";
import { helpCommand } from "./commands/help.js";
import { newTaskCommand } from "./commands/newtask.js";
import { myTasksCommand } from "./commands/mytasks.js";
import { boardCommand } from "./commands/board.js";
import { taskCallback } from "./callbacks/task.js";
import { onboardingCallback } from "./callbacks/onboarding.js";

export const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Sign in and view your teams" },
  { command: "help", description: "Show help and quick actions" },
  { command: "newtask", description: "Create a task" },
  { command: "mytasks", description: "View your assigned tasks" },
  { command: "board", description: "Open the team task board" },
];

export function registerBotInteractions(bot: Bot): void {
  bot.command("/start", startCommand);
  bot.command("/help", helpCommand);
  bot.command("/newtask", newTaskCommand);
  bot.command("/mytasks", myTasksCommand);
  bot.command("/board", boardCommand);

  bot.callback(/^onboard:/, onboardingCallback);
  bot.callback(/^task:/, taskCallback);
}
