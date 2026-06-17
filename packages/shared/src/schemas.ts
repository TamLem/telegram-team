import { z } from "zod";
import { TaskStatus, Priority, TeamRole } from "./enums.js";

export const userIdSchema = z.string().min(1);
export const teamIdSchema = z.string().min(1);
export const taskIdSchema = z.string().min(1);

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
