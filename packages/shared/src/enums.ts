export enum TaskStatus {
  TODO = "todo",
  DOING = "doing",
  BLOCKED = "blocked",
  DONE = "done",
  CANCELLED = "cancelled",
}

export enum Priority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export enum TeamRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

export enum MembershipStatus {
  ACTIVE = "active",
  REMOVED = "removed",
}

export enum JoinRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

export enum TaskEventType {
  TASK_CREATED = "task_created",
  STATUS_CHANGED = "status_changed",
  ASSIGNEE_CHANGED = "assignee_changed",
  PRIORITY_CHANGED = "priority_changed",
  DUE_DATE_CHANGED = "due_date_changed",
  COMMENT_ADDED = "comment_added",
  TASK_CANCELLED = "task_cancelled",
  TASK_COMPLETED = "task_completed",
}

export enum TeamEventType {
  JOIN_REQUEST_APPROVED = "join_request_approved",
  JOIN_REQUEST_REJECTED = "join_request_rejected",
  MEMBER_ADDED = "member_added",
  MEMBER_REMOVED = "member_removed",
  MEMBER_ROLE_CHANGED = "member_role_changed",
}

export enum ChoreInterval {
  DAILY = "daily",
  WEEKLY = "weekly",
  BIWEEKLY = "biweekly",
  MONTHLY = "monthly",
  /** Use with intervalDays (every N days). */
  CUSTOM = "custom",
}
