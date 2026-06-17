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

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function createDb(dbUrl?: string) {
  if (dbInstance) return dbInstance;

  const root = findWorkspaceRoot(__dirname);

  const url =
    dbUrl ??
    process.env.DATABASE_URL ??
    path.join(root, "data", "app.db");

  const dir = path.dirname(url);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(url);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

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
