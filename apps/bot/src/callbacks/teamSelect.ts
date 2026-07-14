import type { BotContext } from "@telegram-team/bot-engine";
import { syncUser } from "../apiClient.js";
import {
  loadUserTeams,
  setUserPreferredTeam,
  buildTeamSwitchKeyboard,
  type TeamAction,
} from "../teamContext.js";
import { boardCommand } from "../commands/board.js";
import { newTaskCommand } from "../commands/newtask.js";
import { blockedCommand } from "../commands/blocked.js";
import { teamCommand } from "../commands/team.js";
import { membersCommand } from "../commands/members.js";
import { inviteCommand } from "../commands/invite.js";

const ACTIONS: Record<TeamAction, (ctx: BotContext, opts?: { teamId?: string }) => Promise<void>> = {
  board: boardCommand,
  newtask: newTaskCommand,
  blocked: blockedCommand,
  team: teamCommand,
  members: membersCommand,
  invite: inviteCommand,
};

function isTeamAction(value: string): value is TeamAction {
  return value in ACTIONS;
}

export async function teamSelectCallback(
  ctx: BotContext,
  _match: RegExpMatchArray | null
): Promise<void> {
  const data = ctx.callbackData;
  if (!data) {
    await ctx.answerCallbackQuery("Unsupported action");
    return;
  }

  const from = ctx.from;
  if (!from) return;

  const parts = data.split(":");
  // team:switch:<action> | team:select:<action>:<teamId>
  const kind = parts[1];
  const action = parts[2];

  if (!action || !isTeamAction(action)) {
    await ctx.answerCallbackQuery("Unsupported action");
    return;
  }

  const apiUser = await syncUser(from);
  const { teams, preferredTeamId } = await loadUserTeams(apiUser.id);

  if (teams.length === 0) {
    await ctx.answerCallbackQuery("No teams");
    await ctx.reply("You are not in any team. Use /start to get started.");
    return;
  }

  if (kind === "switch") {
    await ctx.answerCallbackQuery();
    await ctx.reply("Choose a team:", {
      reply_markup: buildTeamSwitchKeyboard(
        teams,
        action,
        preferredTeamId ?? undefined
      ),
    });
    return;
  }

  if (kind === "select") {
    const teamId = parts[3];
    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      await ctx.answerCallbackQuery("Team not found");
      return;
    }

    try {
      await setUserPreferredTeam(apiUser.id, team.id);
    } catch {
      // still re-run command with explicit team
    }

    await ctx.answerCallbackQuery(`Using ${team.name}`);
    await ACTIONS[action](ctx, { teamId: team.id });
    return;
  }

  await ctx.answerCallbackQuery("Unsupported action");
}
