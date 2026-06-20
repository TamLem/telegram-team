import type { FC } from "hono/jsx";

export const MiniAppNav: FC<{
  ctx?: string;
  teamId?: string;
  current?: "tasks" | "board" | "team" | "new";
}> = ({ ctx, teamId, current }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";
  const links: Array<{ label: string; href: string; id: string }> = [
    { label: "Tasks", href: teamId ? `/app/board/${teamId}?assignee=me${ctxQuery ? "&" + ctx : ""}` : "#", id: "tasks" },
    { label: "Board", href: teamId ? `/app/board/${teamId}${ctxQuery}` : "#", id: "board" },
    { label: "Team", href: `/app/team${ctxQuery}`, id: "team" },
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
      <a href={`/app/tasks/new${ctxQuery}`} class="miniapp-nav-cta">
        + New
      </a>
    </nav>
  );
};
