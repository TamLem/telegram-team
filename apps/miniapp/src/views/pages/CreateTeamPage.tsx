import type { FC } from "hono/jsx";

export const CreateTeamPage: FC<{ ctx?: string; error?: string }> = ({ ctx, error }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  return (
    <div>
      <div class="header">
        <h1>Create Team</h1>
      </div>

      {error && (
        <div class="card" style="background: #fef2f2; border-color: #fecaca; color: #dc2626; margin-bottom: 16px; font-size: 14px;">
          {error}
        </div>
      )}

      <div class="card">
        <form method="post" action={`/app/onboarding/create-team${ctxQuery}`}>
          <input type="hidden" name="ctx" value={ctx ?? ""} />
          <div class="form-group">
            <label class="form-label" for="name">Team Name</label>
            <input
              class="form-input"
              type="text"
              id="name"
              name="name"
              placeholder="e.g. Operations"
              required
              maxlength={100}
            />
          </div>

          <button type="submit" class="btn btn-block">
            Create Team
          </button>
        </form>
      </div>
    </div>
  );
};
