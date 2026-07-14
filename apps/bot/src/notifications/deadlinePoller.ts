import { getEnv, getEnvOptional } from "@telegram-team/config";
import { fetchWithTimeout } from "../http.js";
import { logError } from "../logger.js";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const INTERNAL_API_KEY = getEnvOptional("INTERNAL_API_KEY") ?? "";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const INTERNAL_FETCH_TIMEOUT_MS = 30_000;

interface DeadlineCheckResult {
  dueSoon: number;
  overdue: number;
}

async function fetchDeadlineCheck(): Promise<DeadlineCheckResult> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/internal/deadline-check`,
    {
      method: "POST",
      timeoutMs: INTERNAL_FETCH_TIMEOUT_MS,
      headers: {
        "X-Internal-API-Key": INTERNAL_API_KEY,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to run deadline check: ${res.status}`);
  }
  return res.json() as Promise<DeadlineCheckResult>;
}

export class DeadlinePoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private inFlight = false;

  start(): void {
    if (this.timer) return;

    if (!INTERNAL_API_KEY) {
      console.warn("[deadline] INTERNAL_API_KEY not set, poller disabled");
      return;
    }

    console.log("[deadline] poller started (5m interval)");
    this.running = true;
    this.timer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);

    void this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[deadline] poller stopped");
  }

  private async poll(): Promise<void> {
    if (!this.running || this.inFlight) return;
    this.inFlight = true;

    try {
      const result = await fetchDeadlineCheck();
      if (result.dueSoon > 0 || result.overdue > 0) {
        console.log(
          `[deadline] created ${result.dueSoon} due-soon + ${result.overdue} overdue notifications`
        );
      }
    } catch (err) {
      logError(
        "[deadline] poll error",
        err instanceof Error ? err : new Error(String(err))
      );
    } finally {
      this.inFlight = false;
    }
  }
}
