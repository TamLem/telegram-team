import type { FC } from "hono/jsx";
import { MiniAppNav } from "../components/MiniAppNav.js";

export const TeamPage: FC<{
  team: { id: string; name: string; inviteCode: string };
  userRole: string;
  memberCount: number;
  pendingRequestCount: number;
  ctx?: string;
  error?: string;
}> = ({ team, userRole, memberCount, pendingRequestCount, ctx, error }) => {
  const ctxQuery = "";
  const isAdmin = userRole === "owner" || userRole === "admin";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={team.id} current="team" />

      <a href={`/app/board/${team.id}${ctxQuery}`} class="back-link">
        &larr; Back
      </a>

      <div class="header">
        <h1>{team.name}</h1>
        {error && (
          <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-top: 8px; font-size: 14px;">
            {error}
          </p>
        )}
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="form-label">Your Role</span>
          <span class="badge badge-doing">{userRole}</span>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; gap: 16px;">
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 24px; font-weight: 700;">{memberCount}</div>
            <div class="card-subtitle">Members</div>
          </div>
          {isAdmin && (
            <div style="flex: 1; text-align: center;">
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: pendingRequestCount > 0
                    ? "var(--tg-theme-destructive-text-color, #dc2626)"
                    : "inherit",
                }}
              >
                {pendingRequestCount}
              </div>
              <div class="card-subtitle">Pending Requests</div>
            </div>
          )}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <a href={`/app/team/members${ctxQuery}`} class="btn btn-block btn-secondary">
          View Members
        </a>
        <a href={`/app/team/invite${ctxQuery}`} class="btn btn-block btn-secondary">
          Invite People
        </a>
        {isAdmin && (
          <a href={`/app/team/join-requests${ctxQuery}`} class="btn btn-block btn-secondary">
            Join Requests{pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ""}
          </a>
        )}
        {isAdmin && (
          <a href={`/app/team/settings${ctxQuery}`} class="btn btn-block btn-secondary">
            Team Settings
          </a>
        )}
      </div>
    </div>
  );
};
