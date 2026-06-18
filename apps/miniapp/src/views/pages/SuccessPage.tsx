import type { FC } from "hono/jsx";

export const SuccessPage: FC<{
  message: string;
  redirectUrl?: string;
  autoClose?: boolean;
}> = ({ message, redirectUrl, autoClose = true }) => {
  const script = redirectUrl
    ? `setTimeout(function(){ window.location.href = ${JSON.stringify(redirectUrl)}; }, 1000);`
    : autoClose
      ? `setTimeout(function(){ try { window.Telegram?.WebApp?.close(); } catch(e){} }, 1500);`
      : "";

  return (
    <div class="empty-state" style="padding: 60px 20px;">
      <div class="empty-state-icon" style="font-size: 48px;">✅</div>
      <h2 style="font-size: 20px; margin-bottom: 8px;">Success</h2>
      <p style="font-size: 15px; margin-bottom: 16px;">{message}</p>
      {redirectUrl && (
        <a href={redirectUrl} class="btn" style="margin-top: 12px;">
          View Task
        </a>
      )}
      {script && (
        <script dangerouslySetInnerHTML={{ __html: script }} />
      )}
    </div>
  );
};
