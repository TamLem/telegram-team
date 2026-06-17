import { TelegramApi } from "@telegram-team/bot-engine";
import type { TelegramUpdate } from "@telegram-team/bot-engine";
import type { Bot } from "@telegram-team/bot-engine";

const DEFAULT_POLL_TIMEOUT = 30;
const ERROR_RETRY_DELAY_MS = 5_000;

export interface PollingConfig {
  dropPendingUpdates?: boolean;
  pollTimeout?: number;
  allowedUpdates?: string[];
}

export class PollingSource {
  private api: TelegramApi;
  private bot: Bot;
  private running = false;
  private offset = 0;

  constructor(api: TelegramApi, bot: Bot) {
    this.api = api;
    this.bot = bot;
  }

  async start(config: PollingConfig = {}): Promise<void> {
    const {
      dropPendingUpdates = false,
      pollTimeout = DEFAULT_POLL_TIMEOUT,
      allowedUpdates = ["message", "callback_query"],
    } = config;

    await this.api
      .deleteWebhook({ drop_pending_updates: dropPendingUpdates })
      .then(() => {
        console.log("[polling] webhook deleted");
      })
      .catch((err) => {
        console.error("[polling] failed to delete webhook:", err.message);
      });

    const me = await this.api.getMe();
    console.log(
      `[polling] starting as @${me.username} (timeout=${pollTimeout}s)`
    );

    this.running = true;

    while (this.running) {
      try {
        const updates = await this.api.getUpdates({
          offset: this.offset,
          timeout: pollTimeout,
          allowed_updates: allowedUpdates,
        });

        for (const update of updates) {
          this.offset = update.update_id + 1;
          this.bot.handleUpdate(update).catch((err) => {
            console.error("[polling] update handler error:", err);
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[polling] getUpdates error: ${message}`);
        await sleep(ERROR_RETRY_DELAY_MS);
      }
    }
  }

  stop(): void {
    console.log("[polling] stopping...");
    this.running = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
