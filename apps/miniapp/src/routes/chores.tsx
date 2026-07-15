import { Hono } from "hono";
import {
  requireMiniAppUser,
  setActiveTeam,
  type AppVariables,
} from "../auth/requireMiniAppUser.js";
import {
  listChores,
  listMyChores,
  getChore,
  createChore,
  completeChore,
  updateChore,
  pauseChore,
  getTeamMembers,
  type ChoreResponse,
  type TeamMemberResponse,
} from "../services/apiClient.js";
import { ChoresPage } from "../views/pages/ChoresPage.js";
import { NewChorePage } from "../views/pages/NewChorePage.js";
import { EditChorePage } from "../views/pages/EditChorePage.js";
import { fromDatetimeLocalValue } from "../views/components/ChoreReminderFields.js";

const choresRoutes = new Hono<{ Variables: AppVariables }>();

choresRoutes.use("*", requireMiniAppUser());

export type ChoresView = "mine" | "team";

function parseView(raw: string | undefined | null): ChoresView {
  return raw === "team" ? "team" : "mine";
}

function resolveTeam(c: any): {
  teamId: string | null;
  teamName?: string;
  teams: Array<{ id: string; name: string; role: string }>;
} {
  const teams = c.get("teams") ?? [];
  const activeTeamId = c.get("activeTeamId");
  const team =
    teams.find((t: { id: string }) => t.id === activeTeamId) ?? teams[0];
  return {
    teamId: team?.id ?? null,
    teamName: team?.name,
    teams,
  };
}

function viewFromRequest(c: any, bodyView?: string): ChoresView {
  return parseView(bodyView ?? c.req.query("view"));
}

async function loadMembers(
  teamId: string,
  userId: string
): Promise<{ members: TeamMemberResponse[]; error?: string }> {
  try {
    return { members: await getTeamMembers(teamId, userId) };
  } catch (err) {
    return {
      members: [],
      error:
        err instanceof Error
          ? `Could not load members: ${err.message}`
          : "Could not load team members",
    };
  }
}

async function renderList(
  c: any,
  opts?: { error?: string; success?: string; view?: ChoresView }
) {
  const apiUser = c.get("apiUser");
  const { teamId, teamName, teams } = resolveTeam(c);
  if (teams.length === 0) {
    return c.redirect("/app/onboarding");
  }

  const view = opts?.view ?? viewFromRequest(c);

  // Team board needs an active team
  if (view === "team" && !teamId) {
    return c.redirect("/app/onboarding");
  }

  let chores: ChoreResponse[] = [];
  try {
    if (view === "mine") {
      chores = await listMyChores(apiUser.id);
    } else {
      chores = await listChores(teamId!, apiUser.id);
    }
  } catch (err) {
    return c.render(
      <ChoresPage
        chores={[]}
        view={view}
        teamId={teamId ?? undefined}
        teamName={teamName}
        teams={teams}
        currentUserId={apiUser.id}
        error={err instanceof Error ? err.message : "Failed to load chores"}
      />
    );
  }

  return c.render(
    <ChoresPage
      chores={chores}
      view={view}
      teamId={teamId ?? undefined}
      teamName={teamName}
      teams={teams}
      currentUserId={apiUser.id}
      error={opts?.error}
      success={opts?.success}
    />
  );
}

function renderNew(
  c: any,
  members: TeamMemberResponse[],
  formTeamId: string,
  formTeamName: string | undefined,
  opts?: { error?: string; membersError?: string }
) {
  const apiUser = c.get("apiUser");
  const { teams } = resolveTeam(c);
  return c.render(
    <NewChorePage
      teamId={formTeamId}
      teamName={formTeamName}
      teams={teams}
      members={members}
      currentUserId={apiUser.id}
      error={opts?.error}
      membersError={opts?.membersError}
    />
  );
}

function parseReminderBody(body: {
  interval?: string;
  intervalDays?: string;
  nextDueAt?: string;
  notifyEnabled?: string;
  remindOffsetMinutes?: string;
}): {
  interval: string;
  intervalDays: number | null;
  nextDueAt: string;
  notifyEnabled: boolean;
  remindOffsetMinutes: number;
  error?: string;
} {
  const interval = body.interval ?? "weekly";
  let intervalDays: number | null = null;
  if (interval === "custom") {
    const days = parseInt(body.intervalDays ?? "", 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return {
        interval,
        intervalDays: null,
        nextDueAt: new Date().toISOString(),
        notifyEnabled: true,
        remindOffsetMinutes: 0,
        error: "Custom interval needs a number of days between 1 and 365",
      };
    }
    intervalDays = days;
  }

  if (!body.nextDueAt?.trim()) {
    return {
      interval,
      intervalDays,
      nextDueAt: new Date().toISOString(),
      notifyEnabled: true,
      remindOffsetMinutes: 0,
      error: "Next due date & time is required",
    };
  }

  let nextDueAt: string;
  try {
    nextDueAt = fromDatetimeLocalValue(body.nextDueAt);
  } catch {
    return {
      interval,
      intervalDays,
      nextDueAt: new Date().toISOString(),
      notifyEnabled: true,
      remindOffsetMinutes: 0,
      error: "Invalid date & time",
    };
  }

  const remindOffsetMinutes = parseInt(body.remindOffsetMinutes ?? "0", 10);
  return {
    interval,
    intervalDays,
    nextDueAt,
    notifyEnabled: body.notifyEnabled === "1",
    remindOffsetMinutes: Number.isFinite(remindOffsetMinutes)
      ? Math.max(0, remindOffsetMinutes)
      : 0,
  };
}

/** Default list: Mine across teams. */
choresRoutes.get("/chores", async (c) => renderList(c));

/**
 * New chore.
 * - Multi-team without ?teamId → team picker
 * - Single team or ?teamId= → form
 */
choresRoutes.get("/chores/new", async (c) => {
  const apiUser = c.get("apiUser");
  const { teamId, teamName, teams } = resolveTeam(c);
  if (teams.length === 0) return c.redirect("/app/onboarding");

  const requestedTeamId = c.req.query("teamId");
  const formTeam =
    (requestedTeamId
      ? teams.find((t) => t.id === requestedTeamId)
      : null) ?? (teams.length === 1 ? teams[0] : null);

  if (!formTeam) {
    // Multi-team: pick a workspace first
    return c.render(
      <NewChorePage
        teamId=""
        teams={teams}
        members={[]}
        currentUserId={apiUser.id}
        pickTeam
      />
    );
  }

  const { members, error: membersError } = await loadMembers(
    formTeam.id,
    apiUser.id
  );
  return renderNew(c, members, formTeam.id, formTeam.name ?? teamName, {
    membersError,
  });
});

choresRoutes.post("/chores", async (c) => {
  const apiUser = c.get("apiUser");
  const { teams } = resolveTeam(c);
  if (teams.length === 0) return c.redirect("/app/onboarding");

  const body = await c.req.parseBody<{
    teamId?: string;
    title: string;
    description?: string;
    assigneeUserId: string;
    interval: string;
    intervalDays?: string;
    nextDueAt?: string;
    notifyEnabled?: string;
    remindOffsetMinutes?: string;
    view?: string;
  }>();

  const formTeamId = body.teamId?.trim() || resolveTeam(c).teamId;
  const formTeam = teams.find((t) => t.id === formTeamId);
  if (!formTeamId || !formTeam) {
    return c.render(
      <NewChorePage
        teamId=""
        teams={teams}
        members={[]}
        currentUserId={apiUser.id}
        pickTeam
        error="Choose a team for this chore"
      />
    );
  }

  const { members, error: membersError } = await loadMembers(
    formTeamId,
    apiUser.id
  );

  if (!body.title?.trim() || !body.assigneeUserId) {
    return renderNew(c, members, formTeamId, formTeam.name, {
      error: "Title and assignee are required",
      membersError,
    });
  }

  const reminder = parseReminderBody(body);
  if (reminder.error) {
    return renderNew(c, members, formTeamId, formTeam.name, {
      error: reminder.error,
      membersError,
    });
  }

  try {
    await createChore(formTeamId, apiUser.id, {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      assigneeUserId: body.assigneeUserId,
      interval: reminder.interval,
      intervalDays: reminder.intervalDays,
      nextDueAt: reminder.nextDueAt,
      notifyEnabled: reminder.notifyEnabled,
      remindOffsetMinutes: reminder.remindOffsetMinutes,
    });
    setActiveTeam(c, formTeamId);
    // After create, show team board so the new chore is visible even if assigned to someone else
    return renderList(c, { success: "Chore created", view: "team" });
  } catch (err) {
    return renderNew(c, members, formTeamId, formTeam.name, {
      error: err instanceof Error ? err.message : "Failed to create chore",
      membersError,
    });
  }
});

choresRoutes.get("/chores/:id/edit", async (c) => {
  const apiUser = c.get("apiUser");
  const { teams } = resolveTeam(c);
  if (teams.length === 0) return c.redirect("/app/onboarding");
  const { id } = c.req.param();
  const returnView = viewFromRequest(c);

  try {
    const chore = await getChore(id, apiUser.id);
    if (!chore) {
      return renderList(c, { error: "Chore not found", view: returnView });
    }
    const choreTeam = teams.find((t) => t.id === chore.teamId);
    if (!choreTeam) {
      return renderList(c, {
        error: "You no longer have access to that chore’s team.",
        view: returnView,
      });
    }
    const { members, error: membersError } = await loadMembers(
      chore.teamId,
      apiUser.id
    );
    return c.render(
      <EditChorePage
        chore={chore}
        teamId={chore.teamId}
        teamName={choreTeam.name}
        teams={teams}
        members={members}
        currentUserId={apiUser.id}
        membersError={membersError}
        returnView={returnView}
      />
    );
  } catch (err) {
    return renderList(c, {
      error: err instanceof Error ? err.message : "Failed to load chore",
      view: returnView,
    });
  }
});

choresRoutes.post("/chores/:id/edit", async (c) => {
  const apiUser = c.get("apiUser");
  const { teams } = resolveTeam(c);
  if (teams.length === 0) return c.redirect("/app/onboarding");
  const { id } = c.req.param();

  const body = await c.req.parseBody<{
    title: string;
    description?: string;
    assigneeUserId: string;
    interval: string;
    intervalDays?: string;
    nextDueAt?: string;
    notifyEnabled?: string;
    remindOffsetMinutes?: string;
    view?: string;
  }>();

  const returnView = viewFromRequest(c, body.view);

  const loadEditError = async (error: string) => {
    try {
      const chore = await getChore(id, apiUser.id);
      if (!chore) return renderList(c, { error: "Chore not found", view: returnView });
      const choreTeam = teams.find((t) => t.id === chore.teamId);
      if (!choreTeam) {
        return renderList(c, {
          error: "You no longer have access to that chore’s team.",
          view: returnView,
        });
      }
      const { members, error: membersError } = await loadMembers(
        chore.teamId,
        apiUser.id
      );
      return c.render(
        <EditChorePage
          chore={chore}
          teamId={chore.teamId}
          teamName={choreTeam.name}
          teams={teams}
          members={members}
          currentUserId={apiUser.id}
          error={error}
          membersError={membersError}
          returnView={returnView}
        />
      );
    } catch (err) {
      return renderList(c, {
        error:
          err instanceof Error ? `${error} · ${err.message}` : error,
        view: returnView,
      });
    }
  };

  if (!body.title?.trim() || !body.assigneeUserId) {
    return loadEditError("Title and assignee are required");
  }

  const reminder = parseReminderBody(body);
  if (reminder.error) {
    return loadEditError(reminder.error);
  }

  try {
    const existing = await getChore(id, apiUser.id);
    if (!existing) return renderList(c, { error: "Chore not found", view: returnView });
    if (!teams.some((t) => t.id === existing.teamId)) {
      return renderList(c, {
        error: "You no longer have access to that chore’s team.",
        view: returnView,
      });
    }

    await updateChore(id, apiUser.id, {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      assigneeUserId: body.assigneeUserId,
      interval: reminder.interval,
      intervalDays: reminder.intervalDays,
      nextDueAt: reminder.nextDueAt,
      notifyEnabled: reminder.notifyEnabled,
      remindOffsetMinutes: reminder.remindOffsetMinutes,
    });
    return renderList(c, { success: "Chore updated", view: returnView });
  } catch (err) {
    return loadEditError(
      err instanceof Error ? err.message : "Failed to update chore"
    );
  }
});

async function actionThenList(
  c: any,
  run: () => Promise<void>,
  success: string,
  fail: string
) {
  let bodyView: string | undefined;
  try {
    const body = (await c.req.parseBody()) as { view?: string };
    bodyView = typeof body.view === "string" ? body.view : undefined;
  } catch {
    bodyView = undefined;
  }
  const view = viewFromRequest(c, bodyView);
  try {
    await run();
    return renderList(c, { success, view });
  } catch (err) {
    return renderList(c, {
      error: err instanceof Error ? err.message : fail,
      view,
    });
  }
}

choresRoutes.post("/chores/:id/complete", async (c) => {
  const apiUser = c.get("apiUser");
  const { id } = c.req.param();
  return actionThenList(
    c,
    () => completeChore(id, apiUser.id).then(() => undefined),
    "Chore marked done — next due updated",
    "Could not complete chore"
  );
});

choresRoutes.post("/chores/:id/pause", async (c) => {
  const apiUser = c.get("apiUser");
  const { id } = c.req.param();
  return actionThenList(
    c,
    () => pauseChore(id, apiUser.id).then(() => undefined),
    "Chore paused",
    "Could not pause chore"
  );
});

choresRoutes.post("/chores/:id/resume", async (c) => {
  const apiUser = c.get("apiUser");
  const { id } = c.req.param();
  return actionThenList(
    c,
    () => updateChore(id, apiUser.id, { active: true }).then(() => undefined),
    "Chore resumed",
    "Could not resume chore"
  );
});

/**
 * Deep link /app/chores/:id → edit (any team the user belongs to).
 */
choresRoutes.get("/chores/:id", async (c) => {
  const apiUser = c.get("apiUser");
  const { teams } = resolveTeam(c);
  if (teams.length === 0) return c.redirect("/app/onboarding");
  const { id } = c.req.param();
  const returnView = viewFromRequest(c);

  try {
    const chore = await getChore(id, apiUser.id);
    if (!chore) {
      return renderList(c, { error: "Chore not found", view: returnView });
    }
    if (!teams.some((t) => t.id === chore.teamId)) {
      return renderList(c, {
        error: "You no longer have access to that chore’s team.",
        view: returnView,
      });
    }
    const q = returnView === "team" ? "?view=team" : "?view=mine";
    return c.redirect(`/app/chores/${id}/edit${q}`);
  } catch (err) {
    return renderList(c, {
      error: err instanceof Error ? err.message : "Failed to open chore",
      view: returnView,
    });
  }
});

export { choresRoutes };
