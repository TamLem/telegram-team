import { Hono } from "hono";
import {
  requireMiniAppUser,
  type AppVariables,
} from "../auth/requireMiniAppUser.js";
import {
  listChores,
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

async function loadMembers(
  teamId: string,
  userId: string
): Promise<TeamMemberResponse[]> {
  try {
    return await getTeamMembers(teamId, userId);
  } catch {
    return [];
  }
}

async function renderList(
  c: any,
  opts?: { error?: string; success?: string }
) {
  const apiUser = c.get("apiUser");
  const { teamId, teamName, teams } = resolveTeam(c);
  if (!teamId) {
    return c.redirect("/app/onboarding");
  }

  let chores: ChoreResponse[] = [];
  try {
    chores = await listChores(teamId, apiUser.id);
  } catch (err) {
    return c.render(
      <ChoresPage
        chores={[]}
        teamId={teamId}
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
      teamId={teamId}
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
  error?: string
) {
  const apiUser = c.get("apiUser");
  const { teamId, teamName, teams } = resolveTeam(c);
  return c.render(
    <NewChorePage
      teamId={teamId!}
      teamName={teamName}
      teams={teams}
      members={members}
      currentUserId={apiUser.id}
      error={error}
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

choresRoutes.get("/chores", async (c) => renderList(c));

choresRoutes.get("/chores/new", async (c) => {
  const apiUser = c.get("apiUser");
  const { teamId } = resolveTeam(c);
  if (!teamId) return c.redirect("/app/onboarding");
  const members = await loadMembers(teamId, apiUser.id);
  return renderNew(c, members);
});

choresRoutes.post("/chores", async (c) => {
  const apiUser = c.get("apiUser");
  const { teamId } = resolveTeam(c);
  if (!teamId) return c.redirect("/app/onboarding");

  const body = await c.req.parseBody<{
    title: string;
    description?: string;
    assigneeUserId: string;
    interval: string;
    intervalDays?: string;
    nextDueAt?: string;
    notifyEnabled?: string;
    remindOffsetMinutes?: string;
  }>();

  if (!body.title?.trim() || !body.assigneeUserId) {
    const members = await loadMembers(teamId, apiUser.id);
    return renderNew(c, members, "Title and assignee are required");
  }

  const reminder = parseReminderBody(body);
  if (reminder.error) {
    const members = await loadMembers(teamId, apiUser.id);
    return renderNew(c, members, reminder.error);
  }

  try {
    await createChore(teamId, apiUser.id, {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      assigneeUserId: body.assigneeUserId,
      interval: reminder.interval,
      intervalDays: reminder.intervalDays,
      nextDueAt: reminder.nextDueAt,
      notifyEnabled: reminder.notifyEnabled,
      remindOffsetMinutes: reminder.remindOffsetMinutes,
    });
    return renderList(c, { success: "Chore created" });
  } catch (err) {
    const members = await loadMembers(teamId, apiUser.id);
    return renderNew(
      c,
      members,
      err instanceof Error ? err.message : "Failed to create chore"
    );
  }
});

choresRoutes.get("/chores/:id/edit", async (c) => {
  const apiUser = c.get("apiUser");
  const { teamId, teamName, teams } = resolveTeam(c);
  if (!teamId) return c.redirect("/app/onboarding");
  const { id } = c.req.param();

  try {
    const chore = await getChore(id, apiUser.id);
    if (!chore) {
      return renderList(c, { error: "Chore not found" });
    }
    const members = await loadMembers(teamId, apiUser.id);
    return c.render(
      <EditChorePage
        chore={chore}
        teamId={teamId}
        teamName={teamName}
        teams={teams}
        members={members}
        currentUserId={apiUser.id}
      />
    );
  } catch (err) {
    return renderList(c, {
      error: err instanceof Error ? err.message : "Failed to load chore",
    });
  }
});

choresRoutes.post("/chores/:id/edit", async (c) => {
  const apiUser = c.get("apiUser");
  const { teamId, teamName, teams } = resolveTeam(c);
  if (!teamId) return c.redirect("/app/onboarding");
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
  }>();

  const loadEditError = async (error: string) => {
    try {
      const chore = await getChore(id, apiUser.id);
      if (!chore) return renderList(c, { error: "Chore not found" });
      const members = await loadMembers(teamId, apiUser.id);
      return c.render(
        <EditChorePage
          chore={chore}
          teamId={teamId}
          teamName={teamName}
          teams={teams}
          members={members}
          currentUserId={apiUser.id}
          error={error}
        />
      );
    } catch {
      return renderList(c, { error });
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
    return renderList(c, { success: "Chore updated" });
  } catch (err) {
    return loadEditError(
      err instanceof Error ? err.message : "Failed to update chore"
    );
  }
});

choresRoutes.post("/chores/:id/complete", async (c) => {
  const apiUser = c.get("apiUser");
  const { id } = c.req.param();
  try {
    await completeChore(id, apiUser.id);
    return renderList(c, { success: "Chore marked done — next due updated" });
  } catch (err) {
    return renderList(c, {
      error: err instanceof Error ? err.message : "Could not complete chore",
    });
  }
});

choresRoutes.post("/chores/:id/pause", async (c) => {
  const apiUser = c.get("apiUser");
  const { id } = c.req.param();
  try {
    await pauseChore(id, apiUser.id);
    return renderList(c, { success: "Chore paused" });
  } catch (err) {
    return renderList(c, {
      error: err instanceof Error ? err.message : "Could not pause chore",
    });
  }
});

choresRoutes.post("/chores/:id/resume", async (c) => {
  const apiUser = c.get("apiUser");
  const { id } = c.req.param();
  try {
    await updateChore(id, apiUser.id, { active: true });
    return renderList(c, { success: "Chore resumed" });
  } catch (err) {
    return renderList(c, {
      error: err instanceof Error ? err.message : "Could not resume chore",
    });
  }
});

// Deep link /app/chores/:id → list (prefer /edit for management)
choresRoutes.get("/chores/:id", async (c) => renderList(c));

export { choresRoutes };
