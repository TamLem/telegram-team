import { createLogger } from "@telegram-team/shared";

export const log = createLogger("bot");

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function logError(label: string, error: unknown, context?: Record<string, unknown>): void {
  log.error(label, error, context);
}
