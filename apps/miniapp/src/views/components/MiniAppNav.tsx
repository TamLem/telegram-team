import type { FC } from "hono/jsx";

export const MiniAppNav: FC<{
  ctx?: string;
  teamId?: string;
  teamName?: string;
  teams?: Array<{ id: string; name: string }>;
  current?: "board" | "team" | "new" | "mytasks";
}> = ({ teamId, teamName, teams = [], current }) => {
  const links: Array<{ label: string; href: string; id: string }> = [
    { label: "My Tasks", href: "/app/my-tasks", id: "mytasks" },
    { label: "Board", href: teamId ? `/app/board/${teamId}` : "/app", id: "board" },
    { label: "Team", href: "/app/team", id: "team" },
  ];

  const showSwitcher = teams.length > 1 && teamId;

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
        {showSwitcher && (
          <a href="/app/teams" class="miniapp-nav-team" title="Switch team">
            {teamName ?? "Team"} ▾
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
