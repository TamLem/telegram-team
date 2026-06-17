import { TaskStatus, Priority, TeamRole } from "./enums.js";

export interface User {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  teamId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  userId: string;
  eventType: string;
  data: string | null;
  createdAt: string;
}

export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];
export type PriorityType = (typeof Priority)[keyof typeof Priority];
export type TeamRoleType = (typeof TeamRole)[keyof typeof TeamRole];
