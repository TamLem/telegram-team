import type { MiddlewareHandler } from "hono";

/**
 * Paths and extensions commonly hit by web scanners.
 * Matched case-insensitively; return minimal 404 without HTML rendering.
 */
const PROBE_EXACT = new Set([
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.git",
  "/.git/config",
  "/.git/HEAD",
  "/.aws/credentials",
  "/.well-known/security.txt",
  "/xmlrpc.php",
  "/wp-login.php",
  "/wp-admin",
  "/wp-admin/",
  "/wordpress",
  "/wordpress/",
  "/phpmyadmin",
  "/phpmyadmin/",
  "/admin.php",
  "/cgi-bin",
  "/cgi-bin/",
  "/actuator",
  "/actuator/health",
  "/server-status",
  "/server-info",
  "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
  "/autoload_classmap.php",
  "/config.json",
  "/debug/default/view",
  "/telescope",
  "/_profiler",
  "/api/v1/namespaces",
]);

const PROBE_PREFIXES = [
  "/wp-",
  "/wordpress",
  "/.git/",
  "/.svn/",
  "/.hg/",
  "/phpmyadmin",
  "/pma/",
  "/mysql/",
  "/admin/config",
  "/vendor/phpunit",
  "/cgi-bin/",
  "/.aws/",
  "/actuator/",
];

const PROBE_EXTENSIONS = [
  ".php",
  ".asp",
  ".aspx",
  ".jsp",
  ".cgi",
  ".env",
  ".bak",
  ".sql",
  ".tar.gz",
  ".zip",
  ".7z",
];

export function isProbePath(pathname: string): boolean {
  if (!pathname || pathname === "/") return false;

  const path = pathname.toLowerCase();
  // Strip query-less path only (caller should pass pathname).
  if (PROBE_EXACT.has(path)) return true;

  for (const prefix of PROBE_PREFIXES) {
    if (path === prefix.slice(0, -1) || path.startsWith(prefix)) {
      return true;
    }
  }

  for (const ext of PROBE_EXTENSIONS) {
    if (path.endsWith(ext)) return true;
  }

  // Double-extension / backup style: config.php.bak already covered by .bak
  if (path.includes("/wp-content/") || path.includes("/wp-includes/")) {
    return true;
  }

  return false;
}

/** Early reject for scanner noise — plain 404, no layout, no logs at info. */
export function blockProbes(): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (isProbePath(path)) {
      c.header("Cache-Control", "no-store");
      return c.text("Not Found", 404);
    }
    return next();
  };
}
