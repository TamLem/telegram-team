import type { Bot } from "@telegram-team/bot-engine";
import { getEnv, getEnvOptional } from "@telegram-team/config";
import { miniAppContextUrl } from "../telegram/webApp.js";
import { logError } from "../logger.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");
const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const INTERNAL_API_KEY = getEnvOptional("INTERNAL_API_KEY") ?? "";

const POLL_INTERVAL_MS = 5_000;

interface NotificationItem {
  id: string;
  taskId: string | null;
  teamId: string | null;
  eventType: string;
  payload: string | null;
  createdAt: string;
  recipientTelegramUserId: number;
  recipientFirstName: string;
}

interface NotificationPayload {
  taskTitle?: string;
  taskStatus?: string;
  taskPriority?: string;
  assigneeName?: string | null;
  oldStatus?: string;
  newStatus?: string;
  actorName?: string;
  commentBody?: string;
  taskId?: string;
  teamId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
  doing: "Doing",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

function formatMessage(eventType: string, payload: NotificationPayload): string {
  const title = payload.taskTitle ?? "Unknown task";

  switch (eventType) {
    case "task_created":
      return (
        `<b>Task created</b>\n\n` +
        `Task: ${title}\n` +
        `Status: ${STATUS_LABELS[payload.taskStatus ?? ""] ?? payload.taskStatus ?? "Todo"}\n` +
        `Priority: ${PRIORITY_LABELS[payload.taskPriority ?? ""] ?? payload.taskPriority ?? "Normal"}\n` +
        `Assignee: ${payload.assigneeName ?? "Unassigned"}`
      );

    case "task_assigned":
      return (
        `<b>Task assigned to you</b>\n\n` +
        `Task: ${title}`
      );

    case "task_status_changed":
      return (
        `<b>Task updated</b>\n\n` +
        `${title} is now ${STATUS_LABELS[payload.newStatus ?? ""] ?? payload.newStatus ?? "updated"}.`
      );

    case "task_commented":
      return (
        `<b>New comment on task</b>\n\n` +
        `Task: ${title}\n` +
        `${payload.actorName ?? "Someone"}: ${payload.commentBody ?? ""}`
      );

    default:
      return `<b>Task notification</b>\n\n${title}`;
  }
}

function buildTaskDetailUrl(
  telegramUserId: number,
  teamId: string | null | undefined,
  taskId: string | null | undefined
): string | null {
  if (!teamId || !taskId) return null;
  return miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "view_task",
    telegramUserId,
    teamId,
    returnChatId: telegramUserId,
    taskId,
  });
}

async function fetchUndelivered(limit = 50): Promise<NotificationItem[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/internal/notifications?limit=${limit}`,
    {
      headers: {
        "X-Internal-API-Key": INTERNAL_API_KEY,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch notifications: ${res.status}`);
  }
  const data = (await res.json()) as { notifications: NotificationItem[] };
  return data.notifications;
}

async function markDelivered(id: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/internal/notifications/${id}/delivered`, {
    method: "POST",
    headers: {
      "X-Internal-API-Key": INTERNAL_API_KEY,
    },
  });
}

async function processNotification(
  bot: Bot,
  notification: NotificationItem
): Promise<void> {
  const payload: NotificationPayload = notification.payload
    ? JSON.parse(notification.payload)
    : {};

  const text = formatMessage(notification.eventType, payload);

  const detailUrl = buildTaskDetailUrl(
    notification.recipientTelegramUserId,
    payload.teamId ?? notification.teamId,
    payload.taskId ?? notification.taskId
  );

  const replyMarkup = detailUrl
    ? {
        inline_keyboard: [
          [{ text: "Open Details", web_app: { url: detailUrl } }],
        ],
      }
    : undefined;

  try {
    await bot.api.sendMessage(
      notification.recipientTelegramUserId,
      text,
      replyMarkup ? { reply_markup: replyMarkup } : undefined
    );
  } catch (err) {
    logError(
      `[notifications] failed to send to user ${notification.recipientTelegramUserId}`,
      err instanceof Error ? err : new Error(String(err)),
      { notificationId: notification.id }
    );
  }

  await markDelivered(notification.id);
}

export class NotificationPoller {
  private bot: Bot;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  start(): void {
    if (this.timer) return;

    if (!INTERNAL_API_KEY) {
      console.warn("[notifications] INTERNAL_API_KEY not set, poller disabled");
      return;
    }

    console.log("[notifications] poller started");
    this.running = true;
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);

    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[notifications] poller stopped");
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const notifications = await fetchUndelivered(50);

      for (const notification of notifications) {
        try {
          await processNotification(this.bot, notification);
        } catch (err) {
          logError(
            `[notifications] error processing notification ${notification.id}`,
            err instanceof Error ? err : new Error(String(err))
          );
        }
      }
    } catch (err) {
      logError(
        "[notifications] poll error",
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }
}
