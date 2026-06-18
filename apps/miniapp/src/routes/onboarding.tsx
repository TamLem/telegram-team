import { Hono } from "hono";
import { requireMiniAppContext } from "../auth/requireMiniAppUser.js";
import { OnboardingPage } from "../views/pages/OnboardingPage.js";
import { CreateTeamPage } from "../views/pages/CreateTeamPage.js";
import { JoinTeamPage } from "../views/pages/JoinTeamPage.js";
import { SuccessPage } from "../views/pages/SuccessPage.js";
import { createTeam, joinTeam } from "../services/apiClient.js";
import type { AppVariables } from "../auth/requireMiniAppUser.js";

const onboardingRoutes = new Hono<{ Variables: AppVariables }>();

onboardingRoutes.use("*", requireMiniAppContext());

onboardingRoutes.get("/onboarding", async (c) => {
  return c.render(<OnboardingPage ctx={c.req.query("ctx")} />);
});

onboardingRoutes.get("/onboarding/create-team", async (c) => {
  return c.render(<CreateTeamPage ctx={c.req.query("ctx")} />);
});

onboardingRoutes.post("/onboarding/create-team", async (c) => {
  const apiUser = c.get("apiUser");
  const body = await c.req.parseBody<{ name: string }>();

  if (!body.name || body.name.trim().length === 0) {
    return c.render(<CreateTeamPage ctx={c.req.query("ctx")} error="Team name is required" />);
  }

  try {
    const team = await createTeam(apiUser.id, body.name.trim());

    return c.render(
      <SuccessPage
        message={`Team "${team.name}" created! Invite code: ${team.inviteCode}`}
        autoClose={true}
      />
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create team";
    return c.render(<CreateTeamPage ctx={c.req.query("ctx")} error={errorMsg} />);
  }
});

onboardingRoutes.get("/onboarding/join-team", async (c) => {
  return c.render(<JoinTeamPage ctx={c.req.query("ctx")} />);
});

onboardingRoutes.post("/onboarding/join-team", async (c) => {
  const apiUser = c.get("apiUser");
  const body = await c.req.parseBody<{ inviteCode: string }>();

  if (!body.inviteCode || body.inviteCode.trim().length === 0) {
    return c.render(<JoinTeamPage ctx={c.req.query("ctx")} error="Invite code is required" />);
  }

  try {
    await joinTeam(apiUser.id, body.inviteCode.trim().toUpperCase());

    return c.render(
      <SuccessPage
        message="Join request sent! An admin must approve your request."
        autoClose={true}
      />
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to join team";
    return c.render(<JoinTeamPage ctx={c.req.query("ctx")} error={errorMsg} />);
  }
});

export { onboardingRoutes };
