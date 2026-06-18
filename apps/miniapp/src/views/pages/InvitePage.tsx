import type { FC } from "hono/jsx";

export const InvitePage: FC<{
  teamId: string;
  inviteCode: string;
  userRole: string;
  ctx?: string;
  success?: string;
  error?: string;
}> = ({ teamId, inviteCode, userRole, ctx, success, error }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  const isAdmin = userRole === "owner" || userRole === "admin";

  return (
    <div>
      <a href={`/app/team${ctxQuery}`} class="back-link">
        &larr; Back to Team
      </a>

      <div class="header">
        <h1>Invite Members</h1>
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

      <div class="card">
        <p class="form-label">Invite Code</p>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "28px",
            letterSpacing: "4px",
            fontWeight: 700,
            textAlign: "center",
            padding: "16px 0",
            userSelect: "all",
          }}
        >
          {inviteCode}
        </p>
        <button
          type="button"
          class="btn btn-block btn-secondary"
          onclick={`navigator.clipboard.writeText('${inviteCode}')`}
        >
          Copy Code
        </button>
      </div>

      <div class="card">
        <p class="form-label">How to join</p>
        <p style="font-size: 14px; color: var(--tg-theme-hint-color, #64748b);">
          Share this code with your team members. They can enter it in the Telegram bot using /start and selecting "Join Team".
        </p>
      </div>

      {isAdmin && (
        <div class="card">
          <form method="post" action={`/app/team/invite${ctxQuery}`}>
            <input type="hidden" name="ctx" value={ctx ?? ""} />
            <input type="hidden" name="action" value="regenerate" />
            <p class="form-label" style="margin-bottom: 8px;">Regenerate Code</p>
            <p style="font-size: 13px; color: var(--tg-theme-hint-color, #64748b); margin-bottom: 12px;">
              This will invalidate the current invite code.
            </p>
            <button
              type="submit"
              class="btn btn-block"
              style="background: var(--tg-theme-destructive-text-color, #dc2626);"
              onclick="return confirm('Regenerate invite code? The current code will stop working.')"
            >
              Regenerate Invite Code
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
