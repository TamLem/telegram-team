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
  teamId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdById: string;
  assignedToUserId: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  teamId: string;
  actorUserId: string;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export type TaskStatusType = (typeof import("./enums.js").TaskStatus)[keyof typeof import("./enums.js").TaskStatus];
export type PriorityType = (typeof import("./enums.js").Priority)[keyof typeof import("./enums.js").Priority];
export type TeamRoleType = (typeof import("./enums.js").TeamRole)[keyof typeof import("./enums.js").TeamRole];
