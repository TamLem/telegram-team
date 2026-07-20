import type { Context, MiddlewareHandler, Next } from "hono";
import { clientIp } from "./clientIp.js";

export interface RateLimitOptions {
  /** Max requests per key in the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Bucket key; defaults to client IP. */
  key?: (c: Context) => string;
  /** Skip rate limiting for this request. */
  skip?: (c: Context) => boolean;
  /** Optional prefix so multiple limiters do not share buckets. */
  name?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** In-process fixed window. Fine for a single miniapp replica. */
export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const name = options.name ?? "default";
  let lastPrune = 0;

  function prune(now: number): void {
    if (now - lastPrune < options.windowMs) return;
    lastPrune = now;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    // Hard cap so a flood of unique IPs cannot grow the map without bound.
    if (buckets.size > 50_000) {
      buckets.clear();
    }
  }

  function check(key: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    prune(now);
    const bucketKey = `${name}:${key}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    return {
      allowed: bucket.count <= options.max,
      remaining,
      resetAt: bucket.resetAt,
    };
  }

  const middleware: MiddlewareHandler = async (c: Context, next: Next) => {
    if (options.skip?.(c)) {
      return next();
    }

    const key = options.key?.(c) ?? clientIp(c);
    const result = check(key);
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.resetAt - Date.now()) / 1000)
    );

    c.header("X-RateLimit-Limit", String(options.max));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      c.header("Retry-After", String(retryAfterSec));
      return c.text("Too Many Requests", 429);
    }

    return next();
  };

  return { middleware, check, /** @internal test helper */ _buckets: buckets };
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  return createRateLimiter(options).middleware;
}
