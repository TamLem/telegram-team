import { z } from "zod";
import { TaskStatus, Priority, ChoreInterval } from "./enums.js";

export const userIdSchema = z.string().min(1);
export const teamIdSchema = z.string().min(1);
export const taskIdSchema = z.string().min(1);
export const choreIdSchema = z.string().min(1);

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

export const joinTeamSchema = z.object({
  inviteCode: z.string().min(1).max(50),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL),
  assignedToUserId: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assignedToUserId: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

export const assignTaskSchema = z.object({
  assignedToUserId: z.string().min(1),
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const intervalDaysSchema = z.coerce
  .number()
  .int()
  .min(1, "Interval must be at least 1 day")
  .max(365, "Interval cannot exceed 365 days");

/**
 * When to ping the assignee relative to each chore due time.
 * Always recurring — no “does not repeat” option.
 */
export const REMIND_OFFSET_OPTIONS = [
  { value: 0, label: "When due (each cycle)" },
  { value: 15, label: "15 min before each due" },
  { value: 60, label: "1 hour before each due" },
  { value: 180, label: "3 hours before each due" },
  { value: 1440, label: "1 day before each due" },
  { value: 10080, label: "1 week before each due" },
] as const;

const remindOffsetSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(10080 * 4); // up to ~4 weeks before

export const createChoreSchema = z
  .object({
    title: z.string().min(1).max(500),
    description: z.string().nullable().optional(),
    assigneeUserId: z.string().min(1),
    interval: z.nativeEnum(ChoreInterval).default(ChoreInterval.WEEKLY),
    /** Required when interval is `custom` (every N days). */
    intervalDays: intervalDaysSchema.nullable().optional(),
    /** Explicit next due (ISO datetime). */
    nextDueAt: z.string().min(1).nullable().optional(),
    /** If true and nextDueAt omitted, next due = now. Default true. */
    dueImmediately: z.boolean().optional().default(true),
    notifyEnabled: z.boolean().optional().default(true),
    remindOffsetMinutes: remindOffsetSchema.optional().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.interval === ChoreInterval.CUSTOM) {
      if (data.intervalDays == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "intervalDays is required for custom intervals",
          path: ["intervalDays"],
        });
      }
    }
  });

export const updateChoreSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().nullable().optional(),
    assigneeUserId: z.string().min(1).optional(),
    interval: z.nativeEnum(ChoreInterval).optional(),
    intervalDays: intervalDaysSchema.nullable().optional(),
    active: z.boolean().optional(),
    nextDueAt: z.string().min(1).optional(),
    notifyEnabled: z.boolean().optional(),
    remindOffsetMinutes: remindOffsetSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.interval === ChoreInterval.CUSTOM && data.intervalDays == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "intervalDays is required when setting a custom interval",
        path: ["intervalDays"],
      });
    }
  });
