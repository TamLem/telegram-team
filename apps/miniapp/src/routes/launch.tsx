import { Hono } from "hono";
import {
  requireMiniAppUser,
  setActiveTeam,
  setupAuthRoutes,
  type AppVariables,
} from "../auth/requireMiniAppUser.js";
import { TeamPickerPage } from "../views/pages/TeamPickerPage.js";

const launchRoutes = new Hono<{ Variables: AppVariables }>();

setupAuthRoutes(launchRoutes);

launchRoutes.get("/", requireMiniAppUser(), async (c) => {
  const teams = c.get("teams");
  if (teams.length === 0) {
    return c.redirect("/app/onboarding");
  }
  if (teams.length === 1) {
    setActiveTeam(c, teams[0].id);
    return c.redirect(`/app/board/${teams[0].id}?assignee=me`);
  }
  return c.render(
    <TeamPickerPage
      teams={teams}
      activeTeamId={c.get("activeTeamId")}
    />
  );
});

launchRoutes.post("/team/select", requireMiniAppUser(), async (c) => {
  const body = await c.req.parseBody<{ teamId: string }>();
  const teams = c.get("teams");
  const team = teams.find((candidate) => candidate.id === body.teamId);
  if (!team) {
    c.status(403);
    return c.render(
      <TeamPickerPage
        teams={teams}
        activeTeamId={c.get("activeTeamId")}
        error="You no longer have access to that team."
      />
    );
  }
  setActiveTeam(c, team.id);
  return c.redirect(`/app/board/${team.id}?assignee=me`);
});

export { launchRoutes };
