import { Hono } from "hono";
import {
  requireMiniAppUser,
  setActiveTeam,
  setupAuthRoutes,
  type AppVariables,
} from "../auth/requireMiniAppUser.js";
import { setPreferredTeam, getMyTasks } from "../services/apiClient.js";
import { TeamPickerPage } from "../views/pages/TeamPickerPage.js";
import { MyTasksPage } from "../views/pages/MyTasksPage.js";

const launchRoutes = new Hono<{ Variables: AppVariables }>();

setupAuthRoutes(launchRoutes);

async function preferTeam(
  userId: string,
  teamId: string,
  c: any
): Promise<void> {
  setActiveTeam(c, teamId);
  try {
    await setPreferredTeam(userId, teamId);
  } catch {
    // Cookie still set; preferred team update is best-effort.
  }
}

launchRoutes.get("/", requireMiniAppUser(), async (c) => {
  const teams = c.get("teams");
  if (teams.length === 0) {
    return c.redirect("/app/onboarding");
  }
  if (teams.length === 1) {
    await preferTeam(c.get("apiUser").id, teams[0].id, c);
    return c.redirect(`/app/board/${teams[0].id}?assignee=me`);
  }

  // Multi-team: open preferred board if set, else picker
  const preferred = c.get("preferredTeamId");
  const preferredTeam = teams.find((t) => t.id === preferred);
  if (preferredTeam) {
    await preferTeam(c.get("apiUser").id, preferredTeam.id, c);
    return c.redirect(`/app/board/${preferredTeam.id}?assignee=me`);
  }

  return c.render(
    <TeamPickerPage
      teams={teams}
      activeTeamId={c.get("activeTeamId")}
    />
  );
});

launchRoutes.get("/my-tasks", requireMiniAppUser(), async (c) => {
  const apiUser = c.get("apiUser");
  const teams = c.get("teams");
  if (teams.length === 0) {
    return c.redirect("/app/onboarding");
  }
  const tasks = await getMyTasks(apiUser.id);
  return c.render(
    <MyTasksPage
      tasks={tasks}
      teams={teams}
      activeTeamId={c.get("activeTeamId")}
    />
  );
});

/** Explicit team switcher page (multi-team). */
launchRoutes.get("/teams", requireMiniAppUser(), async (c) => {
  const teams = c.get("teams");
  if (teams.length === 0) {
    return c.redirect("/app/onboarding");
  }
  return c.render(
    <TeamPickerPage
      teams={teams}
      activeTeamId={c.get("activeTeamId")}
    />
  );
});

launchRoutes.post("/team/select", requireMiniAppUser(), async (c) => {
  const body = await c.req.parseBody<{ teamId: string; next?: string }>();
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
  await preferTeam(c.get("apiUser").id, team.id, c);
  const next = typeof body.next === "string" && body.next.startsWith("/app")
    ? body.next
    : `/app/board/${team.id}?assignee=me`;
  return c.redirect(next);
});

export { launchRoutes };
