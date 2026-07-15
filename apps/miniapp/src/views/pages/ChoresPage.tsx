import type { FC } from "hono/jsx";
import {
  formatChoreInterval,
  formatRemindOffset,
} from "@telegram-team/shared";
import type { ChoreResponse } from "../../services/apiClient.js";
import { MiniAppNav } from "../components/MiniAppNav.js";
import { EmptyState } from "../components/EmptyState.js";

function formatNext(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d <= now) return "Due now";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const ChoresPage: FC<{
  chores: ChoreResponse[];
  /** mine = assigned to me (all teams); team = active team board */
  view?: "mine" | "team";
  teamId?: string;
  teamName?: string;
  teams?: Array<{ id: string; name: string; role: string }>;
  currentUserId: string;
  error?: string;
  success?: string;
}> = ({
  chores,
  view = "mine",
  teamId,
  teamName,
  teams = [],
  currentUserId,
  error,
  success,
}) => {
  const now = new Date().toISOString();
  const isMine = view === "mine";
  // Mine API returns active-only; team view includes paused
  const active = chores.filter((c) => c.active === 1);
  const paused = chores.filter((c) => c.active !== 1);
  const due = active.filter((c) => c.nextDueAt <= now);
  const upcoming = active.filter((c) => c.nextDueAt > now);

  const roleOnTeam = (choreTeamId: string) =>
    teams.find((t) => t.id === choreTeamId)?.role;

  const canCompleteChore = (chore: ChoreResponse) => {
    if (chore.active !== 1) return false;
    if (chore.assigneeUserId === currentUserId) return true;
    const role = roleOnTeam(chore.teamId);
    return role === "owner" || role === "admin";
  };

  const canManageChore = (chore: ChoreResponse) => {
    if (chore.assigneeUserId === currentUserId) return true;
    if (chore.createdByUserId === currentUserId) return true;
    const role = roleOnTeam(chore.teamId);
    return role === "owner" || role === "admin";
  };

  const viewQuery = isMine ? "mine" : "team";
  const newHref = isMine
    ? teams.length > 1
      ? "/app/chores/new"
      : `/app/chores/new${teamId ? `?teamId=${teamId}` : ""}`
    : `/app/chores/new${teamId ? `?teamId=${teamId}` : ""}`;

  const renderCard = (chore: ChoreResponse) => {
    const isDue = chore.active === 1 && chore.nextDueAt <= now;
    const isPaused = chore.active !== 1;
    const canComplete = canCompleteChore(chore);
    const canManage = canManageChore(chore);
    const teamLabel =
      chore.teamName ??
      teams.find((t) => t.id === chore.teamId)?.name ??
      null;

    return (
      <article
        class={`chore-card ${isDue ? "chore-card--due" : ""} ${
          isPaused ? "chore-card--paused" : ""
        }`}
      >
        <div class="chore-card-head">
          <div class="chore-card-title-row">
            <h2 class="chore-card-title">{chore.title}</h2>
            {isMine && teamLabel && (
              <span class="chore-team-chip" title="Team">
                {teamLabel}
              </span>
            )}
          </div>
          <div class="chore-card-meta">
            <span class="chore-badge chore-badge-interval" title="Cadence">
              <span class="chore-badge-icon" aria-hidden="true">
                ↻
              </span>
              {formatChoreInterval(chore.interval, chore.intervalDays)}
            </span>
            {isPaused ? (
              <span class="chore-badge chore-badge-paused">
                <span class="chore-badge-icon" aria-hidden="true">
                  ⏸
                </span>
                Paused
              </span>
            ) : isDue ? (
              <span class="chore-badge chore-badge-due">
                <span class="chore-badge-icon" aria-hidden="true">
                  ⚠
                </span>
                Due
              </span>
            ) : (
              <span class="chore-badge chore-badge-ok">
                <span class="chore-badge-icon" aria-hidden="true">
                  📅
                </span>
                {formatNext(chore.nextDueAt)}
              </span>
            )}
            {chore.notifyEnabled === 0 ? (
              <span class="chore-badge chore-badge-paused" title="No Telegram pings">
                <span class="chore-badge-icon" aria-hidden="true">
                  🔇
                </span>
                Silent
              </span>
            ) : (
              <span class="chore-badge chore-badge-interval" title="Notify each cycle">
                <span class="chore-badge-icon" aria-hidden="true">
                  🔔
                </span>
                {formatRemindOffset(chore.remindOffsetMinutes ?? 0).replace(
                  /^Notify /,
                  ""
                )}
              </span>
            )}
          </div>
        </div>

        <div class="chore-card-sub">
          {!isMine && (
            <span class="chore-card-assignee">
              <span aria-hidden="true">👤</span>{" "}
              {chore.assigneeName ? chore.assigneeName : "Assigned"}
            </span>
          )}
          {chore.description ? (
            <span class="chore-card-desc">
              {!isMine ? " · " : ""}
              {chore.description.length > 100
                ? chore.description.slice(0, 100).trimEnd() + "…"
                : chore.description}
            </span>
          ) : null}
        </div>

        {(canComplete || canManage) && (
          <div class="chore-card-actions">
            {canComplete && isDue && (
              <form method="post" action={`/app/chores/${chore.id}/complete`}>
                <input type="hidden" name="view" value={viewQuery} />
                <button type="submit" class="chore-action chore-action--primary">
                  <span aria-hidden="true">✓</span> Done
                </button>
              </form>
            )}
            {canComplete && !isDue && (
              <form method="post" action={`/app/chores/${chore.id}/complete`}>
                <input type="hidden" name="view" value={viewQuery} />
                <button type="submit" class="chore-action">
                  <span aria-hidden="true">✓</span> Early
                </button>
              </form>
            )}
            {canManage && (
              <a
                href={`/app/chores/${chore.id}/edit?view=${viewQuery}`}
                class="chore-action"
              >
                <span aria-hidden="true">✎</span> Edit
              </a>
            )}
            {canManage && !isPaused && (
              <form method="post" action={`/app/chores/${chore.id}/pause`}>
                <input type="hidden" name="view" value={viewQuery} />
                <button type="submit" class="chore-action">
                  <span aria-hidden="true">⏸</span> Pause
                </button>
              </form>
            )}
            {canManage && isPaused && (
              <form method="post" action={`/app/chores/${chore.id}/resume`}>
                <input type="hidden" name="view" value={viewQuery} />
                <button type="submit" class="chore-action chore-action--primary">
                  <span aria-hidden="true">▶</span> Resume
                </button>
              </form>
            )}
          </div>
        )}
      </article>
    );
  };

  /** Mine: group by team under due / upcoming. Team: flat sections. */
  const renderMineSections = () => {
    const groupByTeam = (list: ChoreResponse[]) => {
      const map = new Map<string, ChoreResponse[]>();
      for (const c of list) {
        const arr = map.get(c.teamId) ?? [];
        arr.push(c);
        map.set(c.teamId, arr);
      }
      return map;
    };

    const renderGrouped = (
      list: ChoreResponse[],
      label: string,
      icon: string
    ) => {
      if (list.length === 0) return null;
      const groups = groupByTeam(list);
      return (
        <section class="chore-section">
          <div class="chore-section-label">
            <span aria-hidden="true">{icon}</span> {label} ({list.length})
          </div>
          {Array.from(groups.entries()).map(([tid, items]) => {
            const name =
              items[0]?.teamName ??
              teams.find((t) => t.id === tid)?.name ??
              "Team";
            return (
              <div class="chore-team-group">
                {groups.size > 1 && (
                  <div class="chore-team-group-label">{name}</div>
                )}
                {items.map(renderCard)}
              </div>
            );
          })}
        </section>
      );
    };

    return (
      <>
        {renderGrouped(due, "Due now", "⚠")}
        {renderGrouped(upcoming, "Upcoming", "📅")}
      </>
    );
  };

  return (
    <div class="chores-page">
      <MiniAppNav
        teamId={teamId}
        teamName={teamName}
        teams={teams}
        current="chores"
      />

      <div class="chore-view-toggle" role="tablist" aria-label="Chores view">
        <a
          href="/app/chores?view=mine"
          class={`chore-view-tab ${isMine ? "chore-view-tab--active" : ""}`}
          role="tab"
          aria-selected={isMine ? "true" : "false"}
        >
          <span aria-hidden="true">👤</span> Mine
        </a>
        <a
          href="/app/chores?view=team"
          class={`chore-view-tab ${!isMine ? "chore-view-tab--active" : ""}`}
          role="tab"
          aria-selected={!isMine ? "true" : "false"}
        >
          <span aria-hidden="true">◉</span> Team
          {teamName ? (
            <span class="chore-view-tab-sub">{teamName}</span>
          ) : null}
        </a>
      </div>

      <div class="chores-page-banner">
        <div class="chores-page-banner-icon" aria-hidden="true">
          ↻
        </div>
        <div class="chores-page-banner-body">
          <p class="chores-page-banner-lead">
            {isMine
              ? "Your recurring duties across all teams"
              : "Team chore board — everyone’s cadences"}
          </p>
          <div class="chore-stat-row">
            <span class="chore-stat chore-stat--due">
              <span aria-hidden="true">⚠</span> {due.length} due
            </span>
            <span class="chore-stat">
              <span aria-hidden="true">📅</span> {upcoming.length} upcoming
            </span>
            {!isMine && paused.length > 0 && (
              <span class="chore-stat chore-stat--muted">
                <span aria-hidden="true">⏸</span> {paused.length} paused
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div class="chore-flash chore-flash--error" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div class="chore-flash chore-flash--success" role="status">
          <span aria-hidden="true">✓</span>
          <span>{success}</span>
        </div>
      )}

      <a href={newHref} class="chore-new-btn">
        <span aria-hidden="true">＋</span> New chore
      </a>

      {chores.length === 0 && !error ? (
        <EmptyState
          icon="↻"
          title={isMine ? "No chores assigned to you" : "No chores yet"}
          description={
            isMine
              ? "When a team assigns you a recurring chore, it shows up here. Switch to Team to manage the full board."
              : "Create a recurring chore for a team member — trash day, standups, weekly checks."
          }
        />
      ) : chores.length === 0 && error ? (
        <EmptyState
          icon="⚠"
          title="Couldn’t load chores"
          description="Check the message above and try again."
        />
      ) : isMine ? (
        renderMineSections()
      ) : (
        <>
          {due.length > 0 && (
            <section class="chore-section">
              <div class="chore-section-label">
                <span aria-hidden="true">⚠</span> Due now ({due.length})
              </div>
              {due.map(renderCard)}
            </section>
          )}
          {upcoming.length > 0 && (
            <section class="chore-section">
              <div class="chore-section-label">
                <span aria-hidden="true">📅</span> Upcoming
              </div>
              {upcoming.map(renderCard)}
            </section>
          )}
          {paused.length > 0 && (
            <section class="chore-section">
              <div class="chore-section-label">
                <span aria-hidden="true">⏸</span> Paused
              </div>
              {paused.map(renderCard)}
            </section>
          )}
        </>
      )}
    </div>
  );
};
