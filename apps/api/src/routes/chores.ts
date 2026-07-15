import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";
import { createChoreSchema, updateChoreSchema } from "@telegram-team/shared";
import {
  createChore,
  getChoreById,
  listTeamChores,
  listMyChores,
  updateChore,
  completeChore,
  canManageChore,
  assertAssigneeIsMember,
} from "../services/chore.service.js";
import { getTeamMember } from "../services/membership.service.js";

export const choresRouter = new Hono();

function getUserId(c: any): string {
  return c.get("apiUser")?.id ?? c.req.header("X-User-Id") ?? "";
}

function getTeamId(c: any): string {
  return c.req.header("X-Team-Id") ?? c.req.query("team_id") ?? "";
}

/** Zod hook: always return `{ error: string }` for miniapp-friendly messages. */
function jsonValidator<T extends ZodType>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (!result.success) {
      const message =
        result.error.issues
          .map((i) => i.message)
          .filter(Boolean)
          .join("; ") || "Invalid request";
      return c.json({ error: message }, 400);
    }
  });
}

function serviceErrorResponse(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : fallback;
  if (msg === "Chore not found") {
    return { body: { error: msg }, status: 404 as const };
  }
  if (
    msg.includes("Not allowed") ||
    msg.includes("paused") ||
    msg.includes("not a member")
  ) {
    return { body: { error: msg }, status: 403 as const };
  }
  return { body: { error: msg }, status: 400 as const };
}

choresRouter.get("/chores/mine", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const chores = await listMyChores(userId);
  return c.json({ chores });
});

choresRouter.get("/chores", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const teamId = getTeamId(c);
  if (!teamId) {
    return c.json({ error: "team_id or X-Team-Id required" }, 400);
  }

  const member = await getTeamMember(teamId, userId);
  if (!member) {
    return c.json({ error: "You are not a member of this team" }, 403);
  }

  const chores = await listTeamChores(teamId);
  return c.json({ chores });
});

choresRouter.get("/chores/:id", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const chore = await getChoreById(c.req.param("id"));
  if (!chore) return c.json({ error: "Chore not found" }, 404);

  const member = await getTeamMember(chore.teamId, userId);
  if (!member) {
    return c.json({ error: "You are not a member of this team" }, 403);
  }

  return c.json({ chore });
});

choresRouter.post("/chores", jsonValidator(createChoreSchema), async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const teamId = c.req.header("X-Team-Id") ?? "";
  if (!teamId) {
    return c.json({ error: "X-Team-Id required" }, 400);
  }

  const member = await getTeamMember(teamId, userId);
  if (!member) {
    return c.json({ error: "You are not a member of this team" }, 403);
  }

  const body = c.req.valid("json");

  try {
    await assertAssigneeIsMember(teamId, body.assigneeUserId);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Invalid assignee" },
      400
    );
  }

  try {
    const chore = await createChore({
      teamId,
      title: body.title,
      description: body.description,
      assigneeUserId: body.assigneeUserId,
      createdByUserId: userId,
      interval: body.interval,
      intervalDays: body.intervalDays,
      nextDueAt: body.nextDueAt,
      dueImmediately: body.dueImmediately,
      notifyEnabled: body.notifyEnabled,
      remindOffsetMinutes: body.remindOffsetMinutes,
    });
    return c.json({ chore }, 201);
  } catch (err) {
    const { body: payload, status } = serviceErrorResponse(
      err,
      "Failed to create chore"
    );
    return c.json(payload, status);
  }
});

choresRouter.patch(
  "/chores/:id",
  jsonValidator(updateChoreSchema),
  async (c) => {
    const userId = getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const chore = await getChoreById(c.req.param("id"));
    if (!chore) return c.json({ error: "Chore not found" }, 404);

    if (!(await canManageChore(chore, userId))) {
      return c.json({ error: "Not allowed to update this chore" }, 403);
    }

    const body = c.req.valid("json");

    if (body.assigneeUserId) {
      try {
        await assertAssigneeIsMember(chore.teamId, body.assigneeUserId);
      } catch (err) {
        return c.json(
          { error: err instanceof Error ? err.message : "Invalid assignee" },
          400
        );
      }
    }

    try {
      const updated = await updateChore(chore.id, body);
      return c.json({ chore: updated });
    } catch (err) {
      const { body: payload, status } = serviceErrorResponse(
        err,
        "Failed to update chore"
      );
      return c.json(payload, status);
    }
  }
);

choresRouter.post("/chores/:id/complete", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const chore = await completeChore(c.req.param("id"), userId);
    return c.json({ chore });
  } catch (err) {
    const { body: payload, status } = serviceErrorResponse(
      err,
      "Failed to complete"
    );
    return c.json(payload, status);
  }
});

/** Soft-pause (sets active=false). Not a hard delete. */
choresRouter.delete("/chores/:id", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const chore = await getChoreById(c.req.param("id"));
  if (!chore) return c.json({ error: "Chore not found" }, 404);

  if (!(await canManageChore(chore, userId))) {
    return c.json({ error: "Not allowed to pause this chore" }, 403);
  }

  try {
    const updated = await updateChore(chore.id, { active: false });
    return c.json({ chore: updated });
  } catch (err) {
    const { body: payload, status } = serviceErrorResponse(
      err,
      "Failed to pause chore"
    );
    return c.json(payload, status);
  }
});
