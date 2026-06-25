import type { FC } from "hono/jsx";

export const SuccessPage: FC<{
  title?: string;
  message: string;
  detail?: string;
  redirectUrl?: string;
  autoClose?: boolean;
  closeLabel?: string;
  actionLabel?: string;
}> = ({
  title = "Done",
  message,
  detail,
  redirectUrl,
  autoClose = true,
  closeLabel = "Close",
  actionLabel = "Continue",
}) => {
  const script = redirectUrl
    ? `setTimeout(function(){ window.location.href = ${JSON.stringify(redirectUrl)}; }, 1000);`
    : autoClose
      ? `
        (function () {
          var app = window.Telegram && window.Telegram.WebApp;
          var button = document.getElementById("confirmation-close");
          var close = function () {
            try {
              if (app) {
                app.ready();
                app.close();
                return;
              }
            } catch (e) {}
            if (window.history.length > 1) {
              window.history.back();
            }
          };
          if (button) {
            button.addEventListener("click", close);
          }
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
          {actionLabel}
        </a>
      )}
      {!redirectUrl && (
        <button
          id="confirmation-close"
          type="button"
          class="btn confirmation-action"
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
