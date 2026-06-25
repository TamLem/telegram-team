import type { FC } from "hono/jsx";
import type { TeamEventResponse } from "../../services/apiClient.js";
import { MiniAppNav } from "../components/MiniAppNav.js";
import { EmptyState } from "../components/EmptyState.js";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actorDisplay(event: TeamEventResponse): string {
  return event.actor?.firstName ?? "Someone";
}

function targetDisplay(event: TeamEventResponse): string {
  return event.targetUser?.firstName ?? "a user";
}

function formatTeamEventText(event: TeamEventResponse): string {
  const who = actorDisplay(event);
  const target = targetDisplay(event);

  switch (event.eventType) {
    case "join_request_approved":
      return `${who} approved ${target}'s join request.`;
    case "join_request_rejected":
      return `${who} rejected ${target}'s join request.`;
    case "member_added":
      return `${target} joined the team.`;
    case "member_removed":
      return `${who} removed ${target} from the team.`;
    case "member_role_changed":
      return `${who} changed ${target}'s role from ${event.oldValue ?? "member"} to ${event.newValue ?? "member"}.`;
    default:
      return `${who} performed ${event.eventType.replace(/_/g, " ")}.`;
  }
}

export const TeamActivityPage: FC<{
  teamId: string;
  events: TeamEventResponse[];
  ctx?: string;
  error?: string;
}> = ({ teamId, events, ctx, error }) => {
  const ctxQuery = "";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={teamId} />

      <a href={`/app/team${ctxQuery}`} class="back-link">
        &larr; Back to Team
      </a>

      <div class="header">
        <h1>Team Activity</h1>
      </div>

      {error && (
        <div class="card" style="color: var(--tg-theme-destructive-text-color, #ef4444); margin-bottom: 12px;">
          {error}
        </div>
      )}

      {events.length === 0 && !error ? (
        <EmptyState icon="📋" title="No Activity Yet" description="Team events will appear here as members join, leave, or change roles." />
      ) : (
        <div class="card">
          {events.map((event) => (
            <div style="font-size: 13px; padding: 8px 0; color: var(--tg-theme-text-color, #1e293b); border-bottom: 1px solid var(--tg-theme-secondary-bg-color, #f1f5f9);">
              <span>{formatTeamEventText(event)}</span>
              <span style="font-size: 11px; color: var(--tg-theme-hint-color, #94a3b8); margin-left: 8px;">
                {formatDate(event.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
