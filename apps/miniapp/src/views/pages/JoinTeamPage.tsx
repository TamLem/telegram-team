import type { FC } from "hono/jsx";

export const JoinTeamPage: FC<{ error?: string; success?: string }> = ({ error, success }) => {
  return (
    <div>
      <a href="/app/onboarding" class="back-link">Back</a>

      <div class="header">
        <h1>Join Team</h1>
      </div>

      {error && (
        <div class="card" style="background: #fef2f2; border-color: #fecaca; color: #dc2626; margin-bottom: 16px; font-size: 14px;">
          {error}
        </div>
      )}

      {success ? (
        <div class="card" style="background: #f0fdf4; border-color: #bbf7d0; color: #16a34a;">
          <div style="font-weight: 600; margin-bottom: 4px;">Join request sent</div>
          <div style="font-size: 14px;">An admin must approve your request before you can access the team workspace.</div>
        </div>
      ) : (
        <form method="post" action="/app/onboarding/join-team">
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
      )}
    </div>
  );
};
