import { z } from "zod";
import { TaskStatus, Priority, TeamRole } from "./enums.js";

export const userIdSchema = z.string().uuid();
export const teamIdSchema = z.string().uuid();
export const taskIdSchema = z.string().uuid();

export const createUserSchema = z.object({
  telegramId: z.number().int().positive(),
  username: z.string().nullable().optional(),
  firstName: z.string().min(1),
  lastName: z.string().nullable().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  ownerId: z.string().uuid(),
});

export const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(TeamRole).default(TeamRole.MEMBER),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  assigneeId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  createdById: z.string().uuid(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
