import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  telegramUserId: integer("telegram_user_id").notNull().unique(),
  telegramUsername: text("telegram_username"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  preferredTeamId: text("preferred_team_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  lastSeenAt: text("last_seen_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  inviteCode: text("invite_code").notNull().unique(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const teamJoinRequests = sqliteTable("team_join_requests", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull().default("pending"),
  requestedAt: text("requested_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  reviewedAt: text("reviewed_at"),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("normal"),
  createdById: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id),
  dueAt: text("due_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  cancelledAt: text("cancelled_at"),
  lastRemindedAt: text("last_reminded_at"),
});

export const taskComments = sqliteTable("task_comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const taskEvents = sqliteTable("task_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => users.id),
  eventType: text("event_type").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  teamId: text("team_id").references(() => teams.id),
  recipientUserId: text("recipient_user_id")
    .notNull()
    .references(() => users.id),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => users.id),
  eventType: text("event_type").notNull(),
  payload: text("payload"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  deliveredAt: text("delivered_at"),
});

export const teamEvents = sqliteTable("team_events", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => users.id),
  targetUserId: text("target_user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Recurring team responsibilities — separate from kanban tasks. */
export const chores = sqliteTable("chores", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  title: text("title").notNull(),
  description: text("description"),
  assigneeUserId: text("assignee_user_id")
    .notNull()
    .references(() => users.id),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  /** daily | weekly | biweekly | monthly | custom */
  interval: text("interval").notNull().default("weekly"),
  /** Used when interval is custom (every N days). */
  intervalDays: integer("interval_days"),
  nextDueAt: text("next_due_at").notNull(),
  lastCompletedAt: text("last_completed_at"),
  lastCompletedByUserId: text("last_completed_by_user_id").references(
    () => users.id
  ),
  lastNotifiedAt: text("last_notified_at"),
  /** 1 = send Telegram reminders, 0 = silent (still track due/complete) */
  notifyEnabled: integer("notify_enabled").notNull().default(1),
  /**
   * Minutes before each nextDueAt to notify (applies every cycle).
   * 0 = at due time; 60 = 1 hour before; 1440 = 1 day before.
   */
  remindOffsetMinutes: integer("remind_offset_minutes").notNull().default(0),
  /** 1 = active, 0 = paused */
  active: integer("active").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
