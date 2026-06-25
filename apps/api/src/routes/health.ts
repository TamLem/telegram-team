import { Hono } from "hono";
import { getDb, users } from "@telegram-team/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@telegram-team/shared";

const log = createLogger("api");
export const healthRouter = new Hono();

healthRouter.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

healthRouter.get("/ready", (c) => {
  try {
    const db = getDb();
    db.select({ val: sql`1` }).from(users).limit(1).all();
    return c.json({ status: "ready", timestamp: new Date().toISOString() });
  } catch (err) {
    log.error("[ready] database check failed", err);
    return c.json(
      { status: "not ready", error: "database unavailable" },
      503
    );
  }
});
