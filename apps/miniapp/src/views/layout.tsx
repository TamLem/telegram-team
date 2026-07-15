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

/* --- Board: tabbed single-column --- */
.board-tabs {
  display: flex;
  gap: 0;
  overflow-x: auto;
  margin-bottom: 16px;
  border-bottom: 2px solid var(--tg-theme-hint-color, rgba(0,0,0,0.08));
  -webkit-overflow-scrolling: touch;
}
.board-tab {
  flex-shrink: 0;
  padding: 10px 14px 12px 14px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #94a3b8);
  font-family: inherit;
  position: relative;
  transition: color 0.15s;
  white-space: nowrap;
}
.board-tab::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 1px;
  background: transparent;
  transition: background 0.15s;
}
.board-tab--active {
  color: var(--tg-theme-button-color, #3390ec);
}
.board-tab--active::after {
  background: var(--tg-theme-button-color, #3390ec);
}
.board-tab-count {
  font-size: 11px;
  font-weight: 700;
  margin-left: 4px;
  opacity: 0.7;
}
.board-tab-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
  margin-top: -1px;
}

.board-column-panel {
  /* visible by default when not hidden */
}
.board-column-panel[hidden] {
  display: none;
}

.board-column-empty {
  text-align: center;
  padding: 32px 20px;
  font-size: 14px;
  color: var(--tg-theme-hint-color, #94a3b8);
}

/* --- Board: inline task card (shared) --- */
.board-task {
  border-top: 1px solid var(--tg-theme-hint-color, rgba(0,0,0,0.04));
}
.board-task:first-child { border-top: none; }
.board-task-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.board-task-main {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: flex-start;
  padding: 12px 4px;
  text-decoration: none;
  color: inherit;
  gap: 8px;
}
.board-task-status {
  flex-shrink: 0;
  padding: 14px 4px 0 0;
}
.board-task-body {
  flex: 1;
  min-width: 0;
}
.board-task-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.board-task-desc {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #94a3b8);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.board-task-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.board-task-due {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #94a3b8);
}
.board-task-unassigned {
  font-size: 11px;
  color: #f59e0b;
  font-weight: 500;
}
.board-task-assignee {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
.board-task-actions {
  display: flex;
  gap: 6px;
  padding: 0 4px 10px 4px;
}
.board-task-select {
  min-width: 90px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--tg-theme-hint-color, rgba(0,0,0,0.12));
  background: var(--tg-theme-secondary-bg-color, #fff);
  color: var(--tg-theme-text-color, #222);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.board-task-btn {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  background: var(--tg-theme-secondary-bg-color, #e2e8f0);
  color: var(--tg-theme-text-color, #222);
  text-decoration: none;
  text-align: center;
  font-family: inherit;
  width: 100%;
}
.board-task-btn--ghost {
  background: transparent;
  color: var(--tg-theme-hint-color, #64748b);
}
.board-filter-link {
  font-size: 14px;
  color: var(--tg-theme-link-color, #3390ec);
  text-decoration: none;
}

.empty-state { text-align: center; padding: 48px 20px; color: var(--tg-theme-hint-color, #94a3b8); }
.empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.empty-state h2 { font-size: 18px; margin-bottom: 4px; }
.empty-state p { font-size: 14px; }

.confirmation {
  min-height: calc(100vh - 72px);
  min-height: calc(100svh - 72px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 32px 12px;
  animation: confirmation-enter 280ms ease-out both;
}
.confirmation-mark {
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  margin-bottom: 24px;
  border-radius: 50%;
  color: var(--tg-theme-button-text-color, #fff);
  background: var(--tg-theme-button-color, #3390ec);
  box-shadow: 0 12px 30px rgba(51, 144, 236, 0.24);
  animation: confirmation-mark 420ms 80ms cubic-bezier(.2,.8,.2,1) both;
}
.confirmation-mark svg {
  width: 34px;
  height: 34px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.confirmation-eyebrow {
  margin-bottom: 8px;
  color: var(--tg-theme-button-color, #3390ec);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.confirmation h1 {
  max-width: 360px;
  margin-bottom: 10px;
  font-size: 28px;
  line-height: 1.15;
}
.confirmation-message {
  max-width: 420px;
  color: var(--tg-theme-text-color, #222);
  font-size: 15px;
}
.confirmation-detail {
  max-width: 420px;
  margin-top: 8px;
  color: var(--tg-theme-hint-color, #64748b);
  font-size: 13px;
}
.confirmation-action {
  min-width: 180px;
  margin-top: 26px;
}
@keyframes confirmation-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes confirmation-mark {
  from { opacity: 0; transform: scale(.72); }
  to { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .confirmation,
  .confirmation-mark { animation: none; }
}

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
.form-error {
  margin-top: 8px;
  color: var(--tg-theme-destructive-text-color, #dc2626);
  font-size: 14px;
}
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

.comment-form {
  margin-bottom: 16px;
  border: 1px solid var(--tg-theme-hint-color, rgba(0,0,0,0.1));
  border-radius: 10px;
  overflow: hidden;
}
.comment-form textarea {
  width: 100%;
  min-height: 56px;
  padding: 12px 14px;
  border: none;
  background: var(--tg-theme-secondary-bg-color, #fff);
  color: var(--tg-theme-text-color, #222);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.comment-form textarea::placeholder {
  color: var(--tg-theme-hint-color, #94a3b8);
}
.comment-form-footer {
  display: flex;
  justify-content: flex-end;
  padding: 0 10px 10px 10px;
  background: var(--tg-theme-secondary-bg-color, #fff);
}
.comment-form-footer button {
  padding: 6px 18px;
  border-radius: 8px;
  border: none;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.comment-error {
  color: var(--tg-theme-destructive-text-color, #dc2626);
  font-size: 13px;
  padding: 8px 14px 0 14px;
}

.meta-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.meta-row .badge { margin: 0; }

.task-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }

.team-picker {
  display: grid;
  gap: 8px;
}
.team-picker-option {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--tg-theme-hint-color, rgba(0,0,0,.1));
  border-radius: 12px;
  background: var(--tg-theme-secondary-bg-color, #fff);
  color: var(--tg-theme-text-color, #222);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.team-picker-option span:first-child {
  display: grid;
  gap: 2px;
}
.team-picker-option small {
  color: var(--tg-theme-hint-color, #64748b);
  text-transform: capitalize;
}
.team-picker-option--active {
  border-color: var(--tg-theme-button-color, #3390ec);
}
.team-picker-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}
.team-picker-actions .btn { flex: 1; }

.miniapp-nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.miniapp-nav-team {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-link-color, #3390ec);
  text-decoration: none;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
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

/* Chores — visually distinct from kanban task cards */
.chores-page-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(13, 148, 136, 0.12), rgba(99, 102, 241, 0.1));
  border: 1px solid rgba(13, 148, 136, 0.25);
}
.chores-page-banner-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #0d9488;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.chores-page-banner h1 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #0f766e;
}
.chores-page-banner p {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #64748b);
  margin: 2px 0 0 0;
}
.chore-card {
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-radius: 12px;
  padding: 14px 14px 14px 16px;
  margin-bottom: 10px;
  border: 1px solid rgba(13, 148, 136, 0.18);
  border-left: 4px solid #0d9488;
  box-shadow: 0 1px 3px rgba(13, 148, 136, 0.08);
}
.chore-card--due {
  border-left-color: #f59e0b;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.08), transparent 40%);
}
.chore-card--paused {
  opacity: 0.65;
  border-left-color: #94a3b8;
}
.chore-card-title {
  font-size: 15px;
  font-weight: 650;
  margin-bottom: 4px;
}
.chore-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}
.chore-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.chore-badge-interval {
  background: rgba(13, 148, 136, 0.15);
  color: #0f766e;
}
.chore-badge-due {
  background: #fef3c7;
  color: #b45309;
}
.chore-badge-ok {
  background: #dcfce7;
  color: #15803d;
}
.chore-badge-paused {
  background: #e2e8f0;
  color: #475569;
}
.chore-card-sub {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #64748b);
  margin-bottom: 10px;
}
.chore-done-btn {
  background: #0d9488 !important;
  color: #fff !important;
  border: none;
  width: 100%;
}
.chore-section-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #0f766e;
  margin: 16px 0 8px;
}
`;

const script = `
window.Telegram?.WebApp?.ready();
window.Telegram?.WebApp?.expand();
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
