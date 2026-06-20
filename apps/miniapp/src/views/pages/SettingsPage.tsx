import type { FC } from "hono/jsx";
import { MiniAppNav } from "../components/MiniAppNav.js";

export const SettingsPage: FC<{
  team: { id: string; name: string };
  ctx?: string;
  error?: string;
  success?: string;
}> = ({ team, ctx, error, success }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={team.id} current="team" />

      <a href={`/app/team${ctxQuery}`} class="back-link">
        &larr; Back to Team
      </a>

      <div class="header">
        <h1>Team Settings</h1>
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
        <form method="post" action={`/app/team/settings${ctxQuery}`}>
          <input type="hidden" name="ctx" value={ctx ?? ""} />
          <input type="hidden" name="action" value="updateName" />
          <div class="form-group">
            <label class="form-label">Team Name</label>
            <input
              type="text"
              name="name"
              class="form-input"
              value={team.name}
              maxlength={100}
              required
            />
          </div>
          <button type="submit" class="btn btn-block">Save Changes</button>
        </form>
      </div>
    </div>
  );
};
