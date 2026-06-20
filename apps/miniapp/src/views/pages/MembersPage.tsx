import type { FC } from "hono/jsx";
import type { TeamMemberResponse } from "../../services/apiClient.js";
import { MiniAppNav } from "../components/MiniAppNav.js";
import { EmptyState } from "../components/EmptyState.js";

export const MembersPage: FC<{
  teamId: string;
  members: TeamMemberResponse[];
  userRole: string;
  currentUserId: string;
  ctx?: string;
  error?: string;
  success?: string;
}> = ({ teamId, members, userRole, currentUserId, ctx, error, success }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  const isAdmin = userRole === "owner" || userRole === "admin";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={teamId} current="team" />

      <a href={`/app/team${ctxQuery}`} class="back-link">
        &larr; Back to Team
      </a>

      <div class="header">
        <h1>Members ({members.length})</h1>
        {error && (
          <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-top: 8px; font-size: 14px;">
            {error}
          </p>
        )}
        {success && (
          <p style="color: #16a34a; margin-top: 8px; font-size: 14px;">
            {success}
          </p>
        )}
      </div>

      {members.map((member) => {
        const canManage =
          isAdmin && member.userId !== currentUserId && member.role !== "owner";
        const roleBadge =
          member.role === "owner"
            ? "badge-urgent"
            : member.role === "admin"
              ? "badge-doing"
              : "badge-todo";

        return (
          <div class="card" key={member.id}>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div class="card-title">{member.user.firstName}</div>
                <div class="card-subtitle">
                  {member.user.telegramUsername
                    ? `@${member.user.telegramUsername}`
                    : ""}
                </div>
              </div>
              <span class={`badge ${roleBadge}`}>{member.role}</span>
            </div>

            {canManage && (
              <div style="display: flex; gap: 8px; margin-top: 12px;">
                {member.role === "member" ? (
                  <form method="post" action={`/app/team/members${ctxQuery}`} style="flex: 1;">
                    <input type="hidden" name="ctx" value={ctx ?? ""} />
                    <input type="hidden" name="action" value="promote" />
                    <input type="hidden" name="memberUserId" value={member.userId} />
                    <button type="submit" class="btn btn-secondary btn-block" style="font-size: 13px; padding: 8px 14px;">
                      Promote
                    </button>
                  </form>
                ) : (
                  <form method="post" action={`/app/team/members${ctxQuery}`} style="flex: 1;">
                    <input type="hidden" name="ctx" value={ctx ?? ""} />
                    <input type="hidden" name="action" value="demote" />
                    <input type="hidden" name="memberUserId" value={member.userId} />
                    <button type="submit" class="btn btn-secondary btn-block" style="font-size: 13px; padding: 8px 14px;">
                      Demote
                    </button>
                  </form>
                )}
                <form method="post" action={`/app/team/members${ctxQuery}`} style="flex: 1;">
                  <input type="hidden" name="ctx" value={ctx ?? ""} />
                  <input type="hidden" name="action" value="remove" />
                  <input type="hidden" name="memberUserId" value={member.userId} />
                  <button
                    type="submit"
                    class="btn btn-block"
                    style="font-size: 13px; padding: 8px 14px; background: var(--tg-theme-destructive-text-color, #dc2626);"
                    onclick="return confirm('Remove this member?')"
                  >
                    Remove
                  </button>
                </form>
              </div>
            )}

            {!canManage && member.userId === currentUserId && (
              <div class="card-subtitle" style="margin-top: 8px;">You</div>
            )}
          </div>
        );
      })}

      {members.length === 0 && (
        <EmptyState icon="👤" title="No members" description="Share your invite code to add members.">
          {isAdmin && (
            <a href={`/app/team/invite${ctxQuery}`} class="btn">Invite Members</a>
          )}
        </EmptyState>
      )}
    </div>
  );
};
