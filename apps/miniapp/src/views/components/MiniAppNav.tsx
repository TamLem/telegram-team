import type { FC } from "hono/jsx";

export const MiniAppNav: FC<{
  ctx?: string;
  teamId?: string;
  current?: "board" | "team" | "new";
}> = ({ teamId, current }) => {
  const links: Array<{ label: string; href: string; id: string }> = [
    { label: "Home", href: "/app", id: "home" },
    { label: "Board", href: teamId ? `/app/board/${teamId}` : "#", id: "board" },
    { label: "Team", href: "/app/team", id: "team" },
  ];

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
      <a href="/app/tasks/new" class="miniapp-nav-cta">
        + New
      </a>
    </nav>
  );
};
