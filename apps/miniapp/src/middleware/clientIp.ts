import type { Context } from "hono";

/**
 * Best-effort client IP behind Coolify/Traefik/Cloudflare.
 * Prefer edge headers that a trusted proxy sets; fall back to X-Forwarded-For left-most.
 */
export function clientIp(c: Context): string {
  const cf = c.req.header("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = c.req.header("x-real-ip")?.trim();
  if (real) return real;

  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}
