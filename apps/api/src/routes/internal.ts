import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@telegram-team/config";
import {
  getUndeliveredNotifications,
  markNotificationDelivered,
} from "../services/notification.service.js";
import { processDeadlineAlerts } from "../services/task.service.js";
import { processChoreDueAlerts } from "../services/chore.service.js";

export const internalRouter = new Hono();

function checkInternalKey(c: any): boolean {
  const expected = getEnv("INTERNAL_API_KEY");
  const provided = c.req.header("X-Internal-API-Key");
  if (!expected || !provided) return false;
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

internalRouter.get("/internal/notifications", async (c) => {
  if (!checkInternalKey(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const notifications = await getUndeliveredNotifications(
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50
  );

  return c.json({ notifications });
});

internalRouter.post("/internal/notifications/:id/delivered", async (c) => {
  if (!checkInternalKey(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { id } = c.req.param();
  await markNotificationDelivered(id);

  return c.json({ ok: true });
});

internalRouter.post("/internal/deadline-check", async (c) => {
  if (!checkInternalKey(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const taskResult = await processDeadlineAlerts();
  const choreResult = await processChoreDueAlerts();
  return c.json({
    dueSoon: taskResult.dueSoon,
    overdue: taskResult.overdue,
    choresDue: choreResult.due,
  });
});
