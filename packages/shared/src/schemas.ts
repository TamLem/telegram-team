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

export const approveRejectSchema = z.object({
  reviewerId: z.string().min(1),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  assigneeId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().nullable().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
