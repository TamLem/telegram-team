import type { FC } from "hono/jsx";

export const MiniAppNav: FC<{
  ctx?: string;
  teamId?: string;
  teamName?: string;
  teams?: Array<{ id: string; name: string }>;
  current?: "board" | "team" | "new" | "mytasks" | "chores";
}> = ({ teamId, teamName, teams = [], current }) => {
  const links: Array<{ label: string; href: string; id: string }> = [
    { label: "My Tasks", href: "/app/my-tasks", id: "mytasks" },
    { label: "Board", href: teamId ? `/app/board/${teamId}` : "/app", id: "board" },
    { label: "Chores", href: "/app/chores", id: "chores" },
    { label: "Team", href: "/app/team", id: "team" },
  ];

  // Always expose /app/teams when the user has at least one team so they can
  // switch workspaces or create/join additional teams (single-team users
  // previously had no path to create/join after onboarding).
  const showTeamsEntry = teams.length >= 1 && !!teamId;
  const teamsLabel =
    teams.length > 1
      ? `${teamName ?? "Team"} ▾`
      : teamName
        ? `${teamName} ▾`
        : "Teams ▾";

  return (
    <nav class="miniapp-nav">
      <div class="miniapp-nav-links">
        {links.map((link) => (
          <a
            href={link.href}
            class={`miniapp-nav-link ${current === link.id ? "miniapp-nav-link--active" : ""}`}
          >
            {link.label}
          </a>
        ))}
      </div>
      <div class="miniapp-nav-right">
        {showTeamsEntry && (
          <a
            href="/app/teams"
            class="miniapp-nav-team"
            title={teams.length > 1 ? "Switch team" : "Your teams"}
          >
            {teamsLabel}
          </a>
        )}
        <a
          href={teamId ? `/app/tasks/new` : "/app"}
          class="miniapp-nav-cta"
        >
          + New
        </a>
      </div>
    </nav>
  );
};
