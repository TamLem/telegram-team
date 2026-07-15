import type { FC } from "hono/jsx";
import { MiniAppNav } from "../components/MiniAppNav.js";
import {
  ChoreReminderFields,
  toDatetimeLocalValue,
} from "../components/ChoreReminderFields.js";
import type { TeamMemberResponse } from "../../services/apiClient.js";

export const NewChorePage: FC<{
  teamId: string;
  teamName?: string;
  teams?: Array<{ id: string; name: string; role: string }>;
  members?: TeamMemberResponse[];
  currentUserId?: string;
  error?: string;
  membersError?: string;
  /** Multi-team: show workspace picker before the form. */
  pickTeam?: boolean;
}> = ({
  teamId,
  teamName,
  teams = [],
  members = [],
  currentUserId,
  error,
  membersError,
  pickTeam = false,
}) => {
  const navTeamId = teamId || teams[0]?.id;
  const navTeamName =
    teamName || teams.find((t) => t.id === navTeamId)?.name;

  if (pickTeam || !teamId) {
    return (
      <div class="chores-page">
        <MiniAppNav
          teamId={navTeamId}
          teamName={navTeamName}
          teams={teams}
          current="chores"
        />

        <a href="/app/chores?view=mine" class="back-link">
          &larr; Back to chores
        </a>

        <div class="chores-page-banner">
          <div class="chores-page-banner-icon" aria-hidden="true">
            ↻
          </div>
          <div>
            <h1>New chore</h1>
            <p>Choose which team this recurring duty belongs to</p>
          </div>
        </div>

        {error && (
          <div class="chore-flash chore-flash--error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div class="chore-team-pick">
          {teams.map((t) => (
            <a
              href={`/app/chores/new?teamId=${encodeURIComponent(t.id)}`}
              class="chore-team-pick-card"
            >
              <span class="chore-team-pick-name">{t.name}</span>
              <span class="chore-team-pick-meta">{t.role}</span>
              <span class="chore-team-pick-arrow" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div class="chores-page">
      <MiniAppNav
        teamId={teamId}
        teamName={teamName}
        teams={teams}
        current="chores"
      />

      <a href="/app/chores?view=team" class="back-link">
        &larr; Back to team chores
      </a>

      <div class="chores-page-banner">
        <div class="chores-page-banner-icon" aria-hidden="true">
          ↻
        </div>
        <div>
          <h1>New chore</h1>
          <p>
            {teamName ? (
              <>
                For <strong>{teamName}</strong> — cadence, next due, notify
              </>
            ) : (
              "Recurring duty: cadence, next due, notify each cycle"
            )}
          </p>
        </div>
      </div>

      <div class="card" style="border-left: 4px solid #0d9488;">
        <form method="post" action="/app/chores">
          <input type="hidden" name="teamId" value={teamId} />

          {error && (
            <div class="chore-flash chore-flash--error" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}
          {membersError && (
            <div class="chore-flash chore-flash--error" role="alert">
              <span aria-hidden="true">👤</span>
              <span>{membersError}</span>
            </div>
          )}

          {teams.length > 1 && (
            <p class="page-summary" style="margin-bottom: 12px;">
              Team: <strong>{teamName ?? "Selected"}</strong>
              {" · "}
              <a href="/app/chores/new" style="color:var(--tg-theme-link-color,#3390ec);">
                Change
              </a>
            </p>
          )}

          <div class="form-group">
            <label class="form-label" for="title">
              Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              class="form-input"
              required
              maxlength={500}
              placeholder="e.g. Take out the trash"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="description">
              Notes
            </label>
            <textarea
              id="description"
              name="description"
              class="form-input form-textarea"
              placeholder="Optional details..."
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="assigneeUserId">
              Assignee *
            </label>
            <select
              id="assigneeUserId"
              name="assigneeUserId"
              class="form-select"
              required
            >
              {currentUserId && <option value={currentUserId}>Me</option>}
              {members
                .filter((m) => m.userId !== currentUserId)
                .map((m) => (
                  <option value={m.userId}>
                    {m.user.firstName}
                    {m.user.telegramUsername
                      ? ` (@${m.user.telegramUsername})`
                      : ""}
                  </option>
                ))}
            </select>
            {membersError && (
              <p
                class="card-subtitle"
                style="margin-top:6px;color:var(--tg-theme-destructive-text-color,#dc2626);"
              >
                Member list incomplete — you can still assign yourself if listed
                as Me.
              </p>
            )}
          </div>

          <ChoreReminderFields
            idPrefix="new-chore"
            interval="weekly"
            nextDueLocal={toDatetimeLocalValue()}
            notifyEnabled={true}
            remindOffsetMinutes={0}
          />

          <button
            type="submit"
            class="btn btn-block"
            style="background: #0d9488;"
          >
            Create chore
          </button>
        </form>
      </div>
    </div>
  );
};
