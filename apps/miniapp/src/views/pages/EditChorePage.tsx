import type { FC } from "hono/jsx";
import { MiniAppNav } from "../components/MiniAppNav.js";
import {
  ChoreReminderFields,
  toDatetimeLocalValue,
} from "../components/ChoreReminderFields.js";
import type {
  ChoreResponse,
  TeamMemberResponse,
} from "../../services/apiClient.js";

export const EditChorePage: FC<{
  chore: ChoreResponse;
  teamId: string;
  teamName?: string;
  teams?: Array<{ id: string; name: string; role: string }>;
  members?: TeamMemberResponse[];
  currentUserId?: string;
  error?: string;
  membersError?: string;
  returnView?: "mine" | "team";
}> = ({
  chore,
  teamId,
  teamName,
  teams = [],
  members = [],
  currentUserId,
  error,
  membersError,
  returnView = "mine",
}) => {
  const backHref =
    returnView === "team" ? "/app/chores?view=team" : "/app/chores?view=mine";

  return (
    <div class="chores-page">
      <MiniAppNav
        teamId={teamId}
        teamName={teamName}
        teams={teams}
        current="chores"
      />

      <a href={backHref} class="back-link">
        &larr; Back to chores
      </a>

      <div class="chores-page-banner">
        <div class="chores-page-banner-icon" aria-hidden="true">
          ↻
        </div>
        <div>
          <h1>Edit chore</h1>
          <p>Change cadence, next due, or per-cycle notifications</p>
        </div>
      </div>

      <div class="card" style="border-left: 4px solid #0d9488;">
        <form method="post" action={`/app/chores/${chore.id}/edit`}>
          <input type="hidden" name="view" value={returnView} />
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
          {teamName && (
            <p class="page-summary" style="margin-bottom: 12px;">
              Team: <strong>{teamName}</strong>
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
              value={chore.title}
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
            >
              {chore.description ?? ""}
            </textarea>
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
              {currentUserId && (
                <option
                  value={currentUserId}
                  selected={chore.assigneeUserId === currentUserId}
                >
                  Me
                </option>
              )}
              {members
                .filter((m) => m.userId !== currentUserId)
                .map((m) => (
                  <option
                    value={m.userId}
                    selected={chore.assigneeUserId === m.userId}
                  >
                    {m.user.firstName}
                    {m.user.telegramUsername
                      ? ` (@${m.user.telegramUsername})`
                      : ""}
                  </option>
                ))}
            </select>
          </div>

          <ChoreReminderFields
            idPrefix="edit-chore"
            interval={chore.interval}
            intervalDays={chore.intervalDays}
            nextDueLocal={toDatetimeLocalValue(chore.nextDueAt)}
            notifyEnabled={chore.notifyEnabled !== 0}
            remindOffsetMinutes={chore.remindOffsetMinutes ?? 0}
          />

          <button
            type="submit"
            class="btn btn-block"
            style="background: #0d9488;"
          >
            Save changes
          </button>
        </form>
      </div>
    </div>
  );
};
