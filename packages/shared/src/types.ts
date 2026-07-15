export interface User {
  id: string;
  telegramUserId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  preferredTeamId?: string | null;
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
  lastRemindedAt: string | null;
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

export interface TeamEvent {
  id: string;
  teamId: string;
  actorUserId: string;
  targetUserId: string | null;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  taskId: string | null;
  teamId: string | null;
  recipientUserId: string;
  actorUserId: string;
  eventType: string;
  payload: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface Chore {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  assigneeUserId: string;
  createdByUserId: string;
  interval: string;
  /** Days between occurrences when interval is `custom` (1–365). */
  intervalDays: number | null;
  nextDueAt: string;
  lastCompletedAt: string | null;
  lastCompletedByUserId: string | null;
  lastNotifiedAt: string | null;
  /** 1 = reminders on, 0 = off */
  notifyEnabled: number;
  /** Minutes before due to remind (0 = at due time). */
  remindOffsetMinutes: number;
  active: number;
  createdAt: string;
  updatedAt: string;
  teamName?: string | null;
  assigneeName?: string | null;
}

export interface NotificationPayload {
  taskTitle?: string;
  taskStatus?: string;
  taskPriority?: string;
  assigneeName?: string | null;
  oldStatus?: string;
  newStatus?: string;
  actorName?: string;
  commentBody?: string;
  taskId?: string;
  choreId?: string;
  teamId?: string;
  dueAt?: string | null;
  teamName?: string;
  memberName?: string;
  inviteCode?: string;
  choreInterval?: string;
  choreIntervalDays?: number | null;
  choreTitle?: string;
  remindOffsetMinutes?: number;
}

export type TaskStatusType = (typeof import("./enums.js").TaskStatus)[keyof typeof import("./enums.js").TaskStatus];
export type PriorityType = (typeof import("./enums.js").Priority)[keyof typeof import("./enums.js").Priority];
export type TeamRoleType = (typeof import("./enums.js").TeamRole)[keyof typeof import("./enums.js").TeamRole];
