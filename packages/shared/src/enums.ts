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
  ADMIN = "admin",
  MEMBER = "member",
}

export enum TaskEventType {
  CREATED = "created",
  STATUS_CHANGED = "status_changed",
  PRIORITY_CHANGED = "priority_changed",
  ASSIGNEE_CHANGED = "assignee_changed",
  COMMENTED = "commented",
}
