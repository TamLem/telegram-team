import { Hono } from "hono";
import { requireMiniAppUser } from "../auth/requireMiniAppUser.js";
import { OnboardingPage } from "../views/pages/OnboardingPage.js";
import { CreateTeamPage } from "../views/pages/CreateTeamPage.js";
import { JoinTeamPage } from "../views/pages/JoinTeamPage.js";
import { createTeam, joinTeam } from "../services/apiClient.js";

const onboardingRoutes = new Hono<{
  Variables: { telegramUser: any; apiUser: { id: string }; hasTeam: boolean; teams: any[] };
}>();

onboardingRoutes.use("*", requireMiniAppUser());

onboardingRoutes.get("/onboarding", async (c) => {
  const hasTeam = c.get("hasTeam");

  if (hasTeam) {
    const teams = c.get("teams");
    const teamId = teams?.[0]?.id;
    if (teamId) {
      return c.redirect(`/app/board/${teamId}`);
    }
  }

  return c.render(<OnboardingPage />);
});

onboardingRoutes.get("/onboarding/create-team", async (c) => {
  const hasTeam = c.get("hasTeam");
  if (hasTeam) return c.redirect("/app/board");

  return c.render(<CreateTeamPage />);
});

onboardingRoutes.post("/onboarding/create-team", async (c) => {
  const apiUser = c.get("apiUser");
  const body = await c.req.parseBody<{ name: string }>();

  if (!body.name || body.name.trim().length === 0) {
    return c.render(<CreateTeamPage error="Team name is required" />);
  }

  try {
    const team = await createTeam(apiUser.id, body.name.trim());
    return c.redirect(`/app/board/${team.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create team";
    return c.render(<CreateTeamPage error={message} />);
  }
});

onboardingRoutes.get("/onboarding/join-team", async (c) => {
  const hasTeam = c.get("hasTeam");
  if (hasTeam) return c.redirect("/app/board");

  return c.render(<JoinTeamPage />);
});

onboardingRoutes.post("/onboarding/join-team", async (c) => {
  const apiUser = c.get("apiUser");
  const body = await c.req.parseBody<{ inviteCode: string }>();

  if (!body.inviteCode || body.inviteCode.trim().length === 0) {
    return c.render(<JoinTeamPage error="Invite code is required" />);
  }

  try {
    await joinTeam(apiUser.id, body.inviteCode.trim().toUpperCase());
    return c.render(<JoinTeamPage success="true" />);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send join request";
    return c.render(<JoinTeamPage error={message} />);
  }
});

export { onboardingRoutes };
