import type { FC } from "hono/jsx";

export const JoinTeamPage: FC<{ ctx?: string; error?: string }> = ({ ctx, error }) => {
  return (
    <div>
      <div class="header">
        <h1>Join Team</h1>
      </div>

      {error && (
        <div class="card" style="background: #fef2f2; border-color: #fecaca; color: #dc2626; margin-bottom: 16px; font-size: 14px;">
          {error}
        </div>
      )}

      <div class="card">
        <form method="post" action="/app/onboarding/join-team">
          <input type="hidden" name="ctx" value={ctx ?? ""} />
          <div class="form-group">
            <label class="form-label" for="inviteCode">Invite Code</label>
            <input
              class="form-input"
              type="text"
              id="inviteCode"
              name="inviteCode"
              placeholder="e.g. ABC12345"
              required
              maxlength={50}
              style="text-transform: uppercase;"
            />
          </div>

          <button type="submit" class="btn btn-block">
            Join Team
          </button>
        </form>
      </div>
    </div>
  );
};
