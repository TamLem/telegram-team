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
  teamId: string;
  teamName?: string;
  teams?: Array<{ id: string; name: string; role: string }>;
  currentUserId: string;
  error?: string;
  success?: string;
}> = ({
  chores,
  teamId,
  teamName,
  teams = [],
  currentUserId,
  error,
  success,
}) => {
  const now = new Date().toISOString();
  const active = chores.filter((c) => c.active === 1);
  const paused = chores.filter((c) => c.active !== 1);
  const due = active.filter((c) => c.nextDueAt <= now);
  const upcoming = active.filter((c) => c.nextDueAt > now);

  const myRole = teams.find((t) => t.id === teamId)?.role;
  const isAdmin = myRole === "owner" || myRole === "admin";

  const renderCard = (chore: ChoreResponse) => {
    const isDue = chore.active === 1 && chore.nextDueAt <= now;
    const isPaused = chore.active !== 1;
    const canComplete =
      !isPaused &&
      (chore.assigneeUserId === currentUserId || isAdmin);
    const canManage =
      chore.assigneeUserId === currentUserId ||
      chore.createdByUserId === currentUserId ||
      isAdmin;

    return (
      <div
        class={`chore-card ${isDue ? "chore-card--due" : ""} ${
          isPaused ? "chore-card--paused" : ""
        }`}
      >
        <div class="chore-card-title">{chore.title}</div>
        <div class="chore-card-meta">
          <span class="chore-badge chore-badge-interval">
            {formatChoreInterval(chore.interval, chore.intervalDays)}
          </span>
          {isPaused ? (
            <span class="chore-badge chore-badge-paused">Paused</span>
          ) : isDue ? (
            <span class="chore-badge chore-badge-due">Due</span>
          ) : (
            <span class="chore-badge chore-badge-ok">
              Next {formatNext(chore.nextDueAt)}
            </span>
          )}
          {chore.notifyEnabled === 0 ? (
            <span class="chore-badge chore-badge-paused">Silent cycles</span>
          ) : (
            <span class="chore-badge chore-badge-interval">
              {formatRemindOffset(chore.remindOffsetMinutes ?? 0)}
            </span>
          )}
        </div>
        <div class="chore-card-sub">
          {chore.assigneeName
            ? `Assigned to ${chore.assigneeName}`
            : "Assigned"}
          {chore.description
            ? ` · ${
                chore.description.length > 120
                  ? chore.description.slice(0, 120).trimEnd() + "…"
                  : chore.description
              }`
            : ""}
        </div>
        {canComplete && isDue && (
          <form method="post" action={`/app/chores/${chore.id}/complete`}>
            <button type="submit" class="btn chore-done-btn">
              Mark done
            </button>
          </form>
        )}
        {canComplete && !isDue && (
          <form method="post" action={`/app/chores/${chore.id}/complete`}>
            <button type="submit" class="btn btn-secondary btn-block">
              Complete early
            </button>
          </form>
        )}
        {canManage && (
          <a
            href={`/app/chores/${chore.id}/edit`}
            class="btn btn-secondary btn-block"
            style="margin-top: 6px; text-align: center;"
          >
            Edit cadence &amp; notify
          </a>
        )}
        {canManage && !isPaused && (
          <form
            method="post"
            action={`/app/chores/${chore.id}/pause`}
            style="margin-top: 6px;"
          >
            <button type="submit" class="btn btn-secondary btn-block">
              Pause
            </button>
          </form>
        )}
        {canManage && isPaused && (
          <form method="post" action={`/app/chores/${chore.id}/resume`}>
            <button type="submit" class="btn btn-secondary btn-block">
              Resume
            </button>
          </form>
        )}
      </div>
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

      <div class="chores-page-banner">
        <div class="chores-page-banner-icon" aria-hidden="true">
          ↻
        </div>
        <div>
          <h1>Chores</h1>
          <p>Recurring responsibilities — separate from the task board</p>
        </div>
      </div>

      {error && (
        <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-bottom: 12px; font-size: 14px;">
          {error}
        </p>
      )}
      {success && (
        <p style="color: #16a34a; margin-bottom: 12px; font-size: 14px;">
          {success}
        </p>
      )}

      <a href="/app/chores/new" class="btn btn-block" style="margin-bottom: 16px; background: #0d9488;">
        + New chore
      </a>

      {chores.length === 0 ? (
        <EmptyState
          title="No chores yet"
          description="Create a recurring chore for a team member — trash day, standups, weekly checks."
        />
      ) : (
        <>
          {due.length > 0 && (
            <>
              <div class="chore-section-label">Due now ({due.length})</div>
              {due.map(renderCard)}
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <div class="chore-section-label">Upcoming</div>
              {upcoming.map(renderCard)}
            </>
          )}
          {paused.length > 0 && (
            <>
              <div class="chore-section-label">Paused</div>
              {paused.map(renderCard)}
            </>
          )}
        </>
      )}
    </div>
  );
};
