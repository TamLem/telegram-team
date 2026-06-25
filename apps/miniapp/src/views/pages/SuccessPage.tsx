import type { FC } from "hono/jsx";

export const SuccessPage: FC<{
  title?: string;
  message: string;
  detail?: string;
  redirectUrl?: string;
  autoClose?: boolean;
  closeLabel?: string;
}> = ({
  title = "Done",
  message,
  detail,
  redirectUrl,
  autoClose = true,
  closeLabel = "Close",
}) => {
  const script = redirectUrl
    ? `setTimeout(function(){ window.location.href = ${JSON.stringify(redirectUrl)}; }, 1000);`
    : autoClose
      ? `
        (function () {
          var app = window.Telegram && window.Telegram.WebApp;
          var close = function () { try { app && app.close(); } catch (e) {} };
          if (app && app.MainButton) {
            app.MainButton.setText(${JSON.stringify(closeLabel)});
            app.MainButton.show();
            app.MainButton.onClick(close);
          }
          setTimeout(close, 2200);
        })();
      `
      : "";

  return (
    <main class="confirmation" aria-live="polite">
      <div class="confirmation-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img">
          <path d="m7.5 12.5 3 3 6-7" />
        </svg>
      </div>
      <p class="confirmation-eyebrow">TaskPilot</p>
      <h1>{title}</h1>
      <p class="confirmation-message">{message}</p>
      {detail && <p class="confirmation-detail">{detail}</p>}
      {redirectUrl && (
        <a href={redirectUrl} class="btn confirmation-action">
          View Task
        </a>
      )}
      {!redirectUrl && (
        <button
          type="button"
          class="btn confirmation-action"
          onclick="window.Telegram?.WebApp?.close()"
        >
          {closeLabel}
        </button>
      )}
      {script && (
        <script dangerouslySetInnerHTML={{ __html: script }} />
      )}
    </main>
  );
};
