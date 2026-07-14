import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import {
  getActiveTeams,
  getPreferredTeamId,
  setPreferredTeam,
  type ActiveTeam,
} from "./apiClient.js";

export type TeamAction =
  | "board"
  | "newtask"
  | "blocked"
  | "team"
  | "members"
  | "invite";

export async function loadUserTeams(userId: string): Promise<{
  teams: ActiveTeam[];
  preferredTeamId: string | null;
}> {
  const { teams, preferredTeamId } = await getActiveTeams(userId);
  return { teams, preferredTeamId };
}

/**
 * Resolve which team a team-scoped bot command should use.
 * Preferred (if still a member) → first active team (stable server order).
 */
export function resolveCommandTeam(
  teams: ActiveTeam[],
  preferredTeamId: string | null | undefined
): ActiveTeam | null {
  if (teams.length === 0) return null;
  if (preferredTeamId) {
    const preferred = teams.find((t) => t.id === preferredTeamId);
    if (preferred) return preferred;
  }
  return teams[0];
}

export function buildTeamSwitchKeyboard(
  teams: ActiveTeam[],
  action: TeamAction,
  currentTeamId?: string
): InlineKeyboardMarkup {
  return {
    inline_keyboard: teams.map((team) => [
      {
        text:
          team.id === currentTeamId
            ? `✓ ${team.name}`
            : team.name,
        callback_data: `team:select:${action}:${team.id}`,
      },
    ]),
  };
}

export function appendSwitchRow(
  keyboard: InlineKeyboardMarkup,
  action: TeamAction,
  multiTeam: boolean
): InlineKeyboardMarkup {
  if (!multiTeam) return keyboard;
  return {
    inline_keyboard: [
      ...keyboard.inline_keyboard,
      [{ text: "Switch team", callback_data: `team:switch:${action}` }],
    ],
  };
}

export async function setUserPreferredTeam(
  userId: string,
  teamId: string
): Promise<void> {
  await setPreferredTeam(userId, teamId);
}

export { getPreferredTeamId };
