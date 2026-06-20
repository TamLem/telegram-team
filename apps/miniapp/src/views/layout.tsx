import { html } from "hono/html";
import type { FC } from "hono/jsx";

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; -webkit-text-size-adjust: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--tg-theme-bg-color, #f5f5f5);
  color: var(--tg-theme-text-color, #222);
  line-height: 1.5;
  padding: 16px;
  padding-bottom: 40px;
  min-height: 100vh;
}
.container { max-width: 600px; margin: 0 auto; }

.card {
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  border: 1px solid var(--tg-theme-hint-color, rgba(0,0,0,0.06));
}
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; line-height: 1.3; }
.card-subtitle { font-size: 13px; color: var(--tg-theme-hint-color, #94a3b8); }

.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}
.badge-todo { background: #e2e8f0; color: #475569; }
.badge-doing { background: #dbeafe; color: #1d4ed8; }
.badge-blocked { background: #fef3c7; color: #b45309; }
.badge-done { background: #dcfce7; color: #16a34a; }
.badge-cancelled { background: #fce7f3; color: #be185d; }
.badge-low { background: #e2e8f0; color: #475569; }
.badge-normal { background: #f0fdf4; color: #16a34a; }
.badge-high { background: #fee2e2; color: #dc2626; }
.badge-urgent { background: #fce7f3; color: #be185d; }

.btn {
  display: inline-block;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  border: none;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.9; }
.btn:active { opacity: 0.75; }
.btn-block { display: block; width: 100%; }
.btn-secondary { background: var(--tg-theme-secondary-bg-color, #e2e8f0); color: var(--tg-theme-text-color, #222); }

.columns { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 12px; }
.column {
  flex: 0 0 280px;
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-radius: 12px;
  padding: 12px;
  min-height: 100px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 2px solid var(--tg-theme-hint-color, #e2e8f0);
}
.column-header h3 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--tg-theme-hint-color, #94a3b8);
  font-weight: 700;
}
.column-count {
  font-size: 12px;
  background: var(--tg-theme-hint-color, #e2e8f0);
  color: var(--tg-theme-hint-color, #64748b);
  padding: 2px 8px;
  border-radius: 10px;
}

.empty-state { text-align: center; padding: 48px 20px; color: var(--tg-theme-hint-color, #94a3b8); }
.empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.empty-state h2 { font-size: 18px; margin-bottom: 4px; }
.empty-state p { font-size: 14px; }

.header { margin-bottom: 20px; }
.header h1 { font-size: 24px; font-weight: 700; }
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tg-theme-link-color, #3390ec);
  text-decoration: none;
  font-size: 14px;
  margin-bottom: 12px;
}

.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--tg-theme-hint-color, #64748b); }
.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--tg-theme-hint-color, #cbd5e1);
  background: var(--tg-theme-secondary-bg-color, #fff);
  color: var(--tg-theme-text-color, #222);
  font-size: 15px;
  font-family: inherit;
}
.form-textarea {
  min-height: 100px;
  resize: vertical;
}
.form-select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--tg-theme-hint-color, #cbd5e1);
  background: var(--tg-theme-secondary-bg-color, #fff);
  color: var(--tg-theme-text-color, #222);
  font-size: 15px;
  font-family: inherit;
}

.comment {
  padding: 12px 0;
  border-bottom: 1px solid var(--tg-theme-hint-color, rgba(0,0,0,0.06));
}
.comment:last-child { border-bottom: none; }
.comment-meta { font-size: 12px; color: var(--tg-theme-hint-color, #94a3b8); margin-bottom: 4px; }
.comment-body { font-size: 14px; line-height: 1.5; }

.meta-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.meta-row .badge { margin: 0; }

.task-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }

.miniapp-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0 12px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--tg-theme-hint-color, rgba(0,0,0,0.08));
}
.miniapp-nav-links {
  display: flex;
  gap: 4px;
}
.miniapp-nav-link {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  color: var(--tg-theme-hint-color, #64748b);
  transition: background 0.15s, color 0.15s;
}
.miniapp-nav-link:hover {
  background: var(--tg-theme-secondary-bg-color, rgba(0,0,0,0.06));
}
.miniapp-nav-link--active {
  color: var(--tg-theme-button-color, #3390ec);
  background: rgba(51, 144, 236, 0.1);
}
.miniapp-nav-cta {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
}
</style>
`;

const script = `
window.Telegram?.WebApp?.ready();
window.Telegram?.WebApp?.expand();
try { window.Telegram?.WebApp?.enableClosingConfirmation(); } catch(e) {}
`;

export const Layout: FC<{ children?: any }> = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <script src="https://telegram.org/js/telegram-web-app.js" />
        {html`<style>${css}</style>`}
        <title>Task Manager</title>
      </head>
      <body>
        <div class="container">{children}</div>
        {html`<script>${script}</script>`}
      </body>
    </html>
  );
};
