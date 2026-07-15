import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findWorkspaceRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 10; i++) {
    const yaml = path.join(current, "pnpm-workspace.yaml");
    if (fs.existsSync(yaml)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(__dirname, "..", "..", "..");
}

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL UNIQUE,
  telegram_username TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  preferred_team_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_join_requests (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by_user_id TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  assigned_to_user_id TEXT REFERENCES users(id),
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  team_id TEXT NOT NULL REFERENCES teams(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_join_requests_active_pending
  ON team_join_requests(team_id, user_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_team_user
  ON team_members(team_id, user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id),
  team_id TEXT REFERENCES teams(id),
  recipient_user_id TEXT NOT NULL REFERENCES users(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_undelivered
  ON notifications(delivered_at)
  WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS team_events (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chores (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  title TEXT NOT NULL,
  description TEXT,
  assignee_user_id TEXT NOT NULL REFERENCES users(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  interval TEXT NOT NULL DEFAULT 'weekly',
  interval_days INTEGER,
  next_due_at TEXT NOT NULL,
  last_completed_at TEXT,
  last_completed_by_user_id TEXT REFERENCES users(id),
  last_notified_at TEXT,
  notify_enabled INTEGER NOT NULL DEFAULT 1,
  remind_offset_minutes INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chores_team ON chores(team_id);
CREATE INDEX IF NOT EXISTS idx_chores_due ON chores(active, next_due_at);
`;

function migrateDb(sqlite: Database.Database): void {
  sqlite.exec(DDL);
  try {
    sqlite.exec("ALTER TABLE tasks ADD COLUMN last_reminded_at TEXT");
  } catch {
    // column already exists (or table not yet created — safe to ignore)
  }
  try {
    sqlite.exec("ALTER TABLE users ADD COLUMN preferred_team_id TEXT");
  } catch {
    // column already exists
  }
  try {
    sqlite.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_team_user ON team_members(team_id, user_id)"
    );
  } catch {
    // index may already exist or duplicates prevent creation
  }
  try {
    sqlite.exec(`
CREATE TABLE IF NOT EXISTS chores (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  title TEXT NOT NULL,
  description TEXT,
  assignee_user_id TEXT NOT NULL REFERENCES users(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  interval TEXT NOT NULL DEFAULT 'weekly',
  interval_days INTEGER,
  next_due_at TEXT NOT NULL,
  last_completed_at TEXT,
  last_completed_by_user_id TEXT REFERENCES users(id),
  last_notified_at TEXT,
  notify_enabled INTEGER NOT NULL DEFAULT 1,
  remind_offset_minutes INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
  } catch {
    // table may already exist
  }
  try {
    sqlite.exec("ALTER TABLE chores ADD COLUMN interval_days INTEGER");
  } catch {
    // column already exists
  }
  try {
    sqlite.exec(
      "ALTER TABLE chores ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 1"
    );
  } catch {
    // column already exists
  }
  try {
    sqlite.exec(
      "ALTER TABLE chores ADD COLUMN remind_offset_minutes INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    // column already exists
  }
  try {
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_chores_team ON chores(team_id)");
  } catch {
    // ignore
  }
  try {
    sqlite.exec(
      "CREATE INDEX IF NOT EXISTS idx_chores_due ON chores(active, next_due_at)"
    );
  } catch {
    // ignore
  }
}

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function createDb(dbUrl?: string) {
  if (dbInstance) return dbInstance;

  const root = findWorkspaceRoot(__dirname);

  const url =
    dbUrl ??
    (process.env.DATABASE_URL?.trim() || undefined) ??
    path.join(root, "data", "app.db");

  const dir = path.dirname(url);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(url);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  migrateDb(sqlite);

  dbInstance = drizzle(sqlite, { schema });
  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    return createDb();
  }
  return dbInstance;
}

export type DbClient = ReturnType<typeof createDb>;
