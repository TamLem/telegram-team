export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  DONE = "done",
  CANCELLED = "cancelled",
}

export enum Priority {
  LOW = "low",
  MEDIUM = "medium",
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
  CREATED = "created",
  STATUS_CHANGED = "status_changed",
  PRIORITY_CHANGED = "priority_changed",
  ASSIGNEE_CHANGED = "assignee_changed",
  COMMENTED = "commented",
}
