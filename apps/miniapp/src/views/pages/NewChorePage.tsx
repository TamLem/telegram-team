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
}> = ({
  teamId,
  teamName,
  teams = [],
  members = [],
  currentUserId,
  error,
}) => {
  return (
    <div class="chores-page">
      <MiniAppNav
        teamId={teamId}
        teamName={teamName}
        teams={teams}
        current="chores"
      />

      <a href="/app/chores" class="back-link">
        &larr; Back to chores
      </a>

      <div class="chores-page-banner">
        <div class="chores-page-banner-icon" aria-hidden="true">
          ↻
        </div>
        <div>
          <h1>New chore</h1>
          <p>Recurring duty: cadence, next due, notify each cycle</p>
        </div>
      </div>

      <div class="card" style="border-left: 4px solid #0d9488;">
        <form method="post" action="/app/chores">
          {error && (
            <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-bottom: 12px; font-size: 14px;">
              {error}
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
