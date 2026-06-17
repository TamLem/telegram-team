import type { FC } from "hono/jsx";

export const EmptyState: FC<{
  icon?: string;
  title: string;
  description?: string;
  children?: any;
}> = ({ icon = "📋", title, description, children }) => {
  return (
    <div class="empty-state">
      <div class="empty-state-icon">{icon}</div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children && <div style="margin-top: 16px;">{children}</div>}
    </div>
  );
};
