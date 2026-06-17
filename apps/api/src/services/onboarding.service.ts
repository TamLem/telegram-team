import { findOrCreateTelegramUser } from "./users.service.js";
import { getUserActiveTeams, hasActiveTeam } from "./membership.service.js";
import type { User, Team } from "@telegram-team/shared";

export interface OnboardingState {
  user: User;
  hasTeam: boolean;
  teams: (Team & { role: string })[];
}

export async function getOnboardingState(
  telegramUserId: number,
  firstName: string,
  lastName?: string | null,
  telegramUsername?: string | null
): Promise<OnboardingState> {
  const user = await findOrCreateTelegramUser({
    telegramUserId,
    firstName,
    lastName,
    telegramUsername,
  });

  const hasTeam = await hasActiveTeam(user.id);

  let teams: (Team & { role: string })[] = [];
  if (hasTeam) {
    const memberships = await getUserActiveTeams(user.id);
    teams = memberships.map((m) => ({
      ...m.team,
      role: m.role,
    }));
  }

  return { user, hasTeam, teams };
}

export async function ensureUserIsReady(input: {
  telegramUserId: number;
  firstName: string;
  lastName?: string | null;
  telegramUsername?: string | null;
}): Promise<{ user: User; hasTeam: boolean }> {
  const state = await getOnboardingState(
    input.telegramUserId,
    input.firstName,
    input.lastName,
    input.telegramUsername
  );
  return { user: state.user, hasTeam: state.hasTeam };
}
