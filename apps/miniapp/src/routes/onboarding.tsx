import { Hono } from "hono";
import { requireMiniAppContext } from "../auth/requireMiniAppUser.js";
import { OnboardingPage } from "../views/pages/OnboardingPage.js";
import { CreateTeamPage } from "../views/pages/CreateTeamPage.js";
import { JoinTeamPage } from "../views/pages/JoinTeamPage.js";
import { createTeam, joinTeam } from "../services/apiClient.js";
import type { AppVariables } from "../auth/requireMiniAppUser.js";

const onboardingRoutes = new Hono<{ Variables: AppVariables }>();

onboardingRoutes.get("/onboarding", async (c) => {
  return c.render(<OnboardingPage />);
});

onboardingRoutes.get("/onboarding/create-team", async (c) => {
  return c.render(<CreateTeamPage />);
});

onboardingRoutes.post("/onboarding/create-team", async (c) => {
  const body = await c.req.parseBody<{ name: string }>();

  if (!body.name || body.name.trim().length === 0) {
    return c.render(<CreateTeamPage error="Team name is required" />);
  }

  return c.render(<CreateTeamPage error="Team creation is available via the bot. Use /start in Telegram." />);
});

onboardingRoutes.get("/onboarding/join-team", async (c) => {
  return c.render(<JoinTeamPage />);
});

onboardingRoutes.post("/onboarding/join-team", async (c) => {
  const body = await c.req.parseBody<{ inviteCode: string }>();

  if (!body.inviteCode || body.inviteCode.trim().length === 0) {
    return c.render(<JoinTeamPage error="Invite code is required" />);
  }

  return c.render(<JoinTeamPage error="Joining teams is available via the bot. Use /start in Telegram." />);
});

export { onboardingRoutes };
