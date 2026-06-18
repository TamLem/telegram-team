import type { Bot, BotCommand } from "@telegram-team/bot-engine";
import { startCommand } from "./commands/start.js";
import { helpCommand } from "./commands/help.js";
import { newTaskCommand } from "./commands/newtask.js";
import { myTasksCommand } from "./commands/mytasks.js";
import { boardCommand } from "./commands/board.js";
import { teamCommand } from "./commands/team.js";
import { membersCommand } from "./commands/members.js";
import { inviteCommand } from "./commands/invite.js";
import { blockedCommand } from "./commands/blocked.js";
import { taskCallback } from "./callbacks/task.js";
import { onboardingCallback } from "./callbacks/onboarding.js";

export const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Sign in and view your teams" },
  { command: "help", description: "Show help and quick actions" },
  { command: "newtask", description: "Create a task" },
  { command: "mytasks", description: "View your assigned tasks" },
  { command: "board", description: "Open the team task board" },
  { command: "blocked", description: "View blocked tasks" },
  { command: "team", description: "Open your team workspace" },
  { command: "members", description: "View team members" },
  { command: "invite", description: "Get your team invite code" },
];

export function registerBotInteractions(bot: Bot): void {
  bot.command("/start", startCommand);
  bot.command("/help", helpCommand);
  bot.command("/newtask", newTaskCommand);
  bot.command("/mytasks", myTasksCommand);
  bot.command("/board", boardCommand);
  bot.command("/blocked", blockedCommand);
  bot.command("/team", teamCommand);
  bot.command("/members", membersCommand);
  bot.command("/invite", inviteCommand);

  bot.callback(/^onboard:/, onboardingCallback);
  bot.callback(/^task:/, taskCallback);
}
