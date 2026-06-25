import type { FC } from "hono/jsx";

export const TeamPickerPage: FC<{
  teams: Array<{ id: string; name: string; role: string }>;
  activeTeamId?: string;
  error?: string;
}> = ({ teams, activeTeamId, error }) => {
  return (
    <main>
      <div class="header">
        <h1>Your teams</h1>
        <p class="card-subtitle">Choose the workspace you want to open.</p>
        {error && <p class="form-error">{error}</p>}
      </div>

      <div class="team-picker">
        {teams.map((team) => (
          <form method="post" action="/app/team/select">
            <input type="hidden" name="teamId" value={team.id} />
            <button
              type="submit"
              class={`team-picker-option ${
                team.id === activeTeamId ? "team-picker-option--active" : ""
              }`}
            >
              <span>
                <strong>{team.name}</strong>
                <small>{team.role}</small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        ))}
      </div>

      <div class="team-picker-actions">
        <a href="/app/onboarding/create-team" class="btn btn-secondary">
          Create team
        </a>
        <a href="/app/onboarding/join-team" class="btn btn-secondary">
          Join team
        </a>
      </div>
    </main>
  );
};
