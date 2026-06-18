import { TelegramApi } from "@telegram-team/bot-engine";
import type { TelegramUpdate } from "@telegram-team/bot-engine";
import type { Bot } from "@telegram-team/bot-engine";
import { logError } from "../logger.js";

const DEFAULT_POLL_TIMEOUT = 30;
const ERROR_RETRY_DELAY_MS = 5_000;
const DEFAULT_MAX_UPDATE_FAILURES = 3;
const DEFAULT_HANDLER_TIMEOUT_MS = 25_000;

export interface PollingConfig {
  dropPendingUpdates?: boolean;
  pollTimeout?: number;
  allowedUpdates?: string[];
  maxUpdateFailures?: number;
  retryDelayMs?: number;
  handlerTimeoutMs?: number;
  requestTimeoutMs?: number;
}

export class PollingSource {
  private api: TelegramApi;
  private bot: Bot;
  private running = false;
  private offset = 0;
  private updateFailures = new Map<number, number>();

  constructor(api: TelegramApi, bot: Bot) {
    this.api = api;
    this.bot = bot;
  }

  async start(config: PollingConfig = {}): Promise<void> {
    const {
      dropPendingUpdates = false,
      pollTimeout = DEFAULT_POLL_TIMEOUT,
      allowedUpdates = ["message", "callback_query"],
      maxUpdateFailures = DEFAULT_MAX_UPDATE_FAILURES,
      retryDelayMs = ERROR_RETRY_DELAY_MS,
      handlerTimeoutMs = DEFAULT_HANDLER_TIMEOUT_MS,
      requestTimeoutMs,
    } = config;

    try {
      await this.api.deleteWebhook({ drop_pending_updates: dropPendingUpdates });
      console.log("[polling] webhook deleted");
    } catch (err) {
      logError("[polling] failed to delete webhook; polling cannot start", err);
      throw err;
    }

    console.log(
      `[polling] starting (timeout=${pollTimeout}s, allowed_updates=${allowedUpdates.join(",")}, max_update_failures=${maxUpdateFailures})`
    );

    this.running = true;

    while (this.running) {
      try {
        const updates = await this.api.getUpdates({
          offset: this.offset,
          timeout: pollTimeout,
          allowed_updates: allowedUpdates,
          requestTimeoutMs,
        });

        for (const update of updates) {
          const result = await this.handleUpdate(update, handlerTimeoutMs);
          if (!result.ok) {
            const failures = (this.updateFailures.get(update.update_id) ?? 0) + 1;
            this.updateFailures.set(update.update_id, failures);

            logError("[polling] update handler failed", result.error, {
              updateId: update.update_id,
              failures,
              maxUpdateFailures,
            });

            if (failures < maxUpdateFailures) {
              await sleep(retryDelayMs);
              break;
            }

            console.error(
              `[polling] dead-lettering update after ${failures} failures: update_id=${update.update_id}`
            );
          }

          this.updateFailures.delete(update.update_id);
          this.offset = update.update_id + 1;
        }
      } catch (err) {
        logError("[polling] getUpdates loop error", err, {
          offset: this.offset,
          retryDelayMs,
        });
        await sleep(retryDelayMs);
      }
    }

    console.log("[polling] stopped");
  }

  stop(): void {
    console.log("[polling] stopping...");
    this.running = false;
  }

  private async handleUpdate(
    update: TelegramUpdate,
    timeoutMs: number
  ): ReturnType<Bot["handleUpdate"]> {
    try {
      return await withTimeout(
        this.bot.handleUpdate(update),
        timeoutMs,
        `Update handler timed out after ${timeoutMs}ms`
      );
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}
