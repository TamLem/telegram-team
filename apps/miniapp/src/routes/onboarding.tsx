import { Hono } from "hono";
import { requireMiniAppUser, setActiveTeam } from "../auth/requireMiniAppUser.js";
import { OnboardingPage } from "../views/pages/OnboardingPage.js";
import { CreateTeamPage } from "../views/pages/CreateTeamPage.js";
import { JoinTeamPage } from "../views/pages/JoinTeamPage.js";
import { SuccessPage } from "../views/pages/SuccessPage.js";
import { createTeam, joinTeam } from "../services/apiClient.js";
import type { AppVariables } from "../auth/requireMiniAppUser.js";

const onboardingRoutes = new Hono<{ Variables: AppVariables }>();

onboardingRoutes.use("*", requireMiniAppUser());

onboardingRoutes.get("/onboarding", async (c) => {
  return c.render(<OnboardingPage />);
});

onboardingRoutes.get("/onboarding/create-team", async (c) => {
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
    setActiveTeam(c, team.id);

    return c.render(
      <SuccessPage
        title="Team ready"
        message={`${team.name} is set up. We sent the invite code and next steps to your Telegram chat.`}
        detail={`Invite code: ${team.inviteCode}`}
        redirectUrl={`/app/board/${team.id}`}
        actionLabel="Open board"
      />
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create team";
    return c.render(<CreateTeamPage error={errorMsg} />);
  }
});

onboardingRoutes.get("/onboarding/join-team", async (c) => {
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

    return c.render(
      <SuccessPage
        title="Request sent"
        message="An admin will review your request. We sent a confirmation to your Telegram chat."
        detail="You’ll receive another message when the request is approved or rejected."
        redirectUrl="/app/onboarding"
        actionLabel="Back to onboarding"
      />
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to join team";
    return c.render(<JoinTeamPage error={errorMsg} />);
  }
});

export { onboardingRoutes };
