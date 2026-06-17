import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let envLoaded = false;

function findWorkspaceRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 10; i++) {
    const yaml = path.join(current, "pnpm-workspace.yaml");
    if (fs.existsSync(yaml)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // Fallback: resolve from the package's expected location in node_modules
  return path.resolve(__dirname, "..", "..", "..");
}

export function loadRootEnv(): void {
  if (envLoaded) return;
  envLoaded = true;

  const root = findWorkspaceRoot(__dirname);

  const envLocal = path.join(root, ".env.local");
  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal, override: true });
  }

  const envFile = path.join(root, ".env");
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
}

// Auto-load on import
loadRootEnv();

export function loadEnv(envPath?: string): Record<string, string> {
  if (envPath) {
    dotenv.config({ path: envPath });
  }
  return process.env as Record<string, string>;
}

export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined>
): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnvOptional(key: string): string | undefined {
  return process.env[key] ?? undefined;
}
