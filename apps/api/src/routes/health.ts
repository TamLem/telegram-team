import { Hono } from "hono";
import { getDb, users } from "@telegram-team/db";
import { sql } from "drizzle-orm";

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
    return c.json(
      { status: "not ready", error: "database unavailable" },
      503
    );
  }
});
