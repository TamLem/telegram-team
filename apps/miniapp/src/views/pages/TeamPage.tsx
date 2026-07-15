import type { FC } from "hono/jsx";
import { MiniAppNav } from "../components/MiniAppNav.js";

export const TeamPage: FC<{
  team: { id: string; name: string; inviteCode: string };
  userRole: string;
  memberCount: number;
  pendingRequestCount: number;
  teams?: Array<{ id: string; name: string; role: string }>;
  ctx?: string;
  error?: string;
}> = ({
  team,
  userRole,
  memberCount,
  pendingRequestCount,
  teams = [],
  ctx,
  error,
}) => {
  const ctxQuery = "";
  const isAdmin = userRole === "owner" || userRole === "admin";

  return (
    <div>
      <MiniAppNav
        ctx={ctx}
        teamId={team.id || undefined}
        teamName={team.name}
        teams={teams}
        current="team"
      />

      {error && (
        <p class="page-summary" style="color: var(--tg-theme-destructive-text-color, #dc2626);">
          {error}
        </p>
      )}
      {!error && (
        <p class="page-summary">
          {memberCount} member{memberCount === 1 ? "" : "s"}
          {pendingRequestCount > 0
            ? ` · ${pendingRequestCount} pending request${pendingRequestCount === 1 ? "" : "s"}`
            : ""}
        </p>
      )}

      {team.id ? (
        <>
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
        </>
      ) : null}

      <div class="card" style="margin-top: 16px;">
        <div class="form-label" style="margin-bottom: 8px;">
          More teams
        </div>
        <p class="card-subtitle" style="margin-bottom: 12px;">
          Create another workspace or join one with an invite code.
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          {teams.length > 0 && (
            <a href="/app/teams" class="btn btn-block btn-secondary">
              {teams.length > 1 ? "Switch team" : "Your teams"}
            </a>
          )}
          <a href="/app/onboarding/create-team" class="btn btn-block btn-secondary">
            Create team
          </a>
          <a href="/app/onboarding/join-team" class="btn btn-block btn-secondary">
            Join team
          </a>
        </div>
      </div>
    </div>
  );
};
