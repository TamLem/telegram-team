export interface User {
  id: string;
  telegramUserId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamJoinRequest {
  id: string;
  teamId: string;
  userId: string;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
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

export type TaskStatusType = (typeof import("./enums.js").TaskStatus)[keyof typeof import("./enums.js").TaskStatus];
export type PriorityType = (typeof import("./enums.js").Priority)[keyof typeof import("./enums.js").Priority];
export type TeamRoleType = (typeof import("./enums.js").TeamRole)[keyof typeof import("./enums.js").TeamRole];
