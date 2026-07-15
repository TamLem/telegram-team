import type { FC } from "hono/jsx";

const TABS: Array<{
  label: string;
  id: "mytasks" | "board" | "chores" | "team";
  icon: string;
  href: (teamId?: string) => string;
}> = [
  {
    label: "My Tasks",
    id: "mytasks",
    icon: "☑",
    href: () => "/app/my-tasks",
  },
  {
    label: "Board",
    id: "board",
    icon: "▦",
    href: (teamId) => (teamId ? `/app/board/${teamId}` : "/app"),
  },
  {
    label: "Chores",
    id: "chores",
    icon: "↻",
    href: () => "/app/chores",
  },
  {
    label: "Team",
    id: "team",
    icon: "◉",
    href: () => "/app/team",
  },
];

export const MiniAppNav: FC<{
  ctx?: string;
  teamId?: string;
  teamName?: string;
  teams?: Array<{ id: string; name: string }>;
  current?: "board" | "team" | "new" | "mytasks" | "chores";
}> = ({ teamId, teamName, teams = [], current }) => {
  // Always expose /app/teams when the user has at least one team so they can
  // switch workspaces or create/join additional teams (single-team users
  // previously had no path to create/join after onboarding).
  const showTeamsEntry = teams.length >= 1 && !!teamId;
  const teamsLabel = teamName?.trim() || "Teams";

  return (
    <>
      <header class="miniapp-topbar">
        {showTeamsEntry ? (
          <a
            href="/app/teams"
            class="miniapp-topbar-team"
            title={teams.length > 1 ? "Switch team" : "Your teams"}
          >
            <span class="miniapp-topbar-team-name">{teamsLabel}</span>
            <span class="miniapp-topbar-team-caret" aria-hidden="true">
              ▾
            </span>
          </a>
        ) : (
          <span class="miniapp-topbar-spacer" />
        )}
        <a
          href={teamId ? `/app/tasks/new` : "/app"}
          class="miniapp-topbar-cta"
        >
          + New
        </a>
      </header>

      <nav class="miniapp-tabbar" aria-label="Main">
        <div class="miniapp-tabbar-inner">
          {TABS.map((tab) => (
            <a
              href={tab.href(teamId)}
              class={`miniapp-tab ${current === tab.id ? "miniapp-tab--active" : ""}`}
              aria-current={current === tab.id ? "page" : undefined}
            >
              <span class="miniapp-tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span class="miniapp-tab-label">{tab.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </>
  );
};
