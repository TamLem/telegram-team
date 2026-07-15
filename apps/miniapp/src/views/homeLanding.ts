/**
 * Public origin landing page (`GET /`).
 * App UI and sessions live under `/app`; this page is the friendly entrypoint
 * when someone opens MINIAPP_BASE_URL without a path.
 */
export function renderHomeLandingPage(options: {
  botUsername?: string;
}): string {
  const botUsername = options.botUsername?.replace(/^@/, "").trim() || "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>TaskPi</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
    color: #1e293b;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: #fff;
    border-radius: 16px;
    padding: 36px 28px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    border: 1px solid rgba(0,0,0,0.06);
  }
  .logo {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: #3390ec;
    color: #fff;
    font-weight: 800;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }
  h1 { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
  .lead {
    font-size: 15px;
    color: #64748b;
    line-height: 1.5;
    margin-bottom: 24px;
  }
  .btn {
    display: block;
    width: 100%;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    text-align: center;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-primary {
    background: #3390ec;
    color: #fff;
    margin-bottom: 12px;
  }
  .btn-primary:hover { opacity: 0.92; }
  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .divider::before, .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(0,0,0,0.08);
  }
  #widget { min-height: 40px; margin-bottom: 8px; }
  #status { font-size: 14px; color: #64748b; min-height: 1.3em; margin-bottom: 8px; }
  #status.error { color: #dc2626; }
  .hint { font-size: 12px; color: #94a3b8; line-height: 1.45; margin-top: 16px; }
  a.inline { color: #3390ec; }
</style>
</head>
<body>
<div class="card">
  <div class="logo" aria-hidden="true">T</div>
  <h1>TaskPi</h1>
  <p class="lead">Team tasks and chores — in Telegram or the browser.</p>
  <a class="btn btn-primary" href="/app">Open app</a>
  <div class="divider">or sign in</div>
  <div id="status"></div>
  <div id="widget"></div>
  <p class="hint" id="hint"></p>
</div>
<script>
(function () {
  var botUsername = ${JSON.stringify(botUsername)};
  var statusEl = document.getElementById("status");
  var widgetEl = document.getElementById("widget");
  var hintEl = document.getElementById("hint");

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.className = isError ? "error" : "";
  }

  if (!botUsername) {
    setStatus("Browser sign-in is not configured (missing BOT_USERNAME).", true);
    hintEl.innerHTML = "Use <strong>Open app</strong> from Telegram, or set <code>BOT_USERNAME</code> and authorize this domain with @BotFather → /setdomain.";
    return;
  }

  hintEl.textContent = "Log in with Telegram via @" + botUsername + ". Also available inside the Telegram app.";

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://telegram.org/js/telegram-widget.js?22";
  s.setAttribute("data-telegram-login", botUsername);
  s.setAttribute("data-size", "large");
  s.setAttribute("data-radius", "8");
  s.setAttribute("data-request-access", "write");
  s.setAttribute("data-onauth", "onTelegramAuth(user)");
  widgetEl.appendChild(s);

  window.onTelegramAuth = async function (user) {
    setStatus("Signing you in…");
    try {
      var res = await fetch("/app/auth/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ login: user, returnTo: "/app" }),
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        setStatus(err.error || "Authentication failed.", true);
        return;
      }
      var data = await res.json();
      window.location.href = data.redirect || "/app";
    } catch (e) {
      setStatus("Connection error. Please try again.", true);
    }
  };
})();
</script>
</body>
</html>`;
}

export function renderNotFoundPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Not found — TaskPi</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
    color: #1e293b;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }
  h1 { font-size: 22px; margin-bottom: 8px; }
  p { color: #64748b; margin-bottom: 20px; }
  a {
    display: inline-block;
    padding: 10px 20px;
    border-radius: 10px;
    background: #3390ec;
    color: #fff;
    font-weight: 600;
    text-decoration: none;
  }
</style>
</head>
<body>
<div>
  <h1>Page not found</h1>
  <p>That URL is not part of TaskPi.</p>
  <a href="/app">Go to app</a>
</div>
</body>
</html>`;
}
