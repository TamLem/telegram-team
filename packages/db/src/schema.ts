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
