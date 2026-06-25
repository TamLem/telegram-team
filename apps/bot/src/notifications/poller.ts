import type { Bot } from "@telegram-team/bot-engine";
import { getEnv, getEnvOptional } from "@telegram-team/config";
import { miniAppContextUrl } from "../telegram/webApp.js";
import { logError } from "../logger.js";
import { escapeHtml } from "../telegram/html.js";
import { MAIN_MENU_KEYBOARD } from "../menu.js";

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
  dueAt?: string | null;
  teamName?: string;
  memberName?: string;
  inviteCode?: string;
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

function formatDueDate(dateString: string | null | undefined): string {
  if (!dateString) return "Not set";
  const date = new Date(dateString);
  const hasTime = dateString.includes("T") && dateString.length > 10;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayLabel = date.toDateString() === now.toDateString()
    ? "Today"
    : date.toDateString() === tomorrow.toDateString()
      ? "Tomorrow"
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (hasTime) {
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${dayLabel}, ${time}`;
  }
  return dayLabel;
}

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
        `Task: ${title}\n` +
        `Priority: ${PRIORITY_LABELS[payload.taskPriority ?? ""] ?? payload.taskPriority ?? "Normal"}\n` +
        `Due: ${formatDueDate(payload.dueAt)}`
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

    case "task_blocked":
      return (
        `<b>Task blocked</b>\n\n` +
        `<b>${title}</b> is now blocked.`
      );

    case "task_completed":
      return (
        `<b>Task completed</b>\n\n` +
        `<b>${title}</b> was marked done.`
      );

    case "task_overdue":
      return (
        `<b>Task overdue</b>\n\n` +
        `<b>${title}</b> is past its deadline.\n` +
        `Due: ${formatDueDate(payload.dueAt)}\n` +
        `Priority: ${PRIORITY_LABELS[payload.taskPriority ?? ""] ?? "Normal"}`
      );

    case "task_due_soon":
      return (
        `<b>Task due soon</b>\n\n` +
        `<b>${title}</b> is due ${formatDueDate(payload.dueAt)}.\n` +
        `Priority: ${PRIORITY_LABELS[payload.taskPriority ?? ""] ?? "Normal"}`
      );

    case "assignee_reminded":
      return (
        `<b>Reminder</b>\n\n` +
        `${payload.actorName ?? "Someone"} reminded you about <b>${title}</b>.\n` +
        `Priority: ${PRIORITY_LABELS[payload.taskPriority ?? ""] ?? "Normal"}\n` +
        `Due: ${formatDueDate(payload.dueAt)}`
      );

    case "member_removed":
      return (
        `<b>You were removed from a team</b>\n\n` +
        `You are no longer a member of <b>${payload.taskTitle ?? "a team"}</b>.`
      );

    case "team_created":
      return (
        `<b>Team ready</b>\n\n` +
        `<b>${escapeHtml(payload.teamName ?? "Your team")}</b> has been created.\n` +
        `Invite code: <code>${escapeHtml(payload.inviteCode ?? "Unavailable")}</code>\n\n` +
        `Your TaskPi menu is ready.`
      );

    case "join_request_submitted":
      return (
        `<b>Join request sent</b>\n\n` +
        `Your request to join <b>${escapeHtml(payload.teamName ?? "the team")}</b> is waiting for admin approval.`
      );

    case "join_requested":
      return (
        `<b>New join request</b>\n\n` +
        `User: ${payload.taskTitle ?? "Someone"}\n` +
        `Team: ${payload.teamName ?? "Unknown team"}`
      );

    case "join_request_approved":
      return (
        `<b>Join request approved</b>\n\n` +
        `You are now a member of <b>${escapeHtml(payload.taskTitle ?? "the team")}</b>.\n` +
        `Approved by: ${escapeHtml(payload.memberName ?? "An admin")}\n\n` +
        `Use the keyboard below or the quick actions in the next message.`
      );

    case "join_request_rejected":
      return (
        `<b>Join request rejected</b>\n\n` +
        `Your request to join <b>${payload.taskTitle ?? "a team"}</b> was not approved.`
      );

    default:
      return `<b>Task notification</b>\n\n${title}`;
  }
}

function buildActionUrl(
  eventType: string,
  telegramUserId: number,
  payload: NotificationPayload
): string | null {
  if (eventType === "join_requested") {
    if (!payload.teamId) return null;
    return miniAppContextUrl(MINIAPP_BASE_URL, {
      action: "review_join_requests",
      telegramUserId,
      teamId: payload.teamId,
      returnChatId: telegramUserId,
    });
  }

  if (eventType === "join_request_submitted") {
    return null;
  }

  if (eventType === "team_created") {
    if (!payload.teamId) return null;
    return miniAppContextUrl(MINIAPP_BASE_URL, {
      action: "view_team",
      telegramUserId,
      teamId: payload.teamId,
      returnChatId: telegramUserId,
    });
  }

  if (eventType === "member_removed") {
    return null;
  }

  const teamId = payload.teamId;
  const taskId = payload.taskId;
  if (!teamId || !taskId) return null;
  return miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "view_task",
    telegramUserId,
    teamId,
    returnChatId: telegramUserId,
    taskId,
  });
}

function isMembershipReadyEvent(eventType: string): boolean {
  return eventType === "team_created" ||
    eventType === "join_request_approved";
}

function buildMembershipActionButtons(
  telegramUserId: number,
  teamId: string
): Array<Array<{ text: string; web_app: { url: string } }>> {
  const context = {
    telegramUserId,
    teamId,
    returnChatId: telegramUserId,
  };
  return [
    [
      {
        text: "Open My Tasks",
        web_app: {
          url: miniAppContextUrl(MINIAPP_BASE_URL, {
            action: "view_my_tasks",
            ...context,
          }),
        },
      },
      {
        text: "Open Board",
        web_app: {
          url: miniAppContextUrl(MINIAPP_BASE_URL, {
            action: "view_board",
            ...context,
          }),
        },
      },
    ],
    [
      {
        text: "Team & Members",
        web_app: {
          url: miniAppContextUrl(MINIAPP_BASE_URL, {
            action: "view_team",
            ...context,
          }),
        },
      },
    ],
  ];
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

  const detailUrl = buildActionUrl(
    notification.eventType,
    notification.recipientTelegramUserId,
    payload
  );

  const boardUrl =
    !notification.eventType.startsWith("join_request") &&
    notification.eventType !== "team_created" &&
    payload.teamId
      ? miniAppContextUrl(MINIAPP_BASE_URL, {
          action: "view_board",
          telegramUserId: notification.recipientTelegramUserId,
          teamId: payload.teamId,
          returnChatId: notification.recipientTelegramUserId,
        })
      : null;

  const buttons: Array<Array<{ text: string; web_app: { url: string } }>> = [];
  if (detailUrl) {
    buttons.push([
      {
        text: notification.eventType.startsWith("join_request")
          ? "Review Request"
          : notification.eventType === "team_created"
            ? "Open Team"
          : "Open Details",
        web_app: { url: detailUrl },
      },
    ]);
  }
  if (boardUrl) {
    buttons.push([
      {
        text: "Open Board",
        web_app: { url: boardUrl },
      },
    ]);
  }

  const replyMarkup = buttons.length > 0
    ? { inline_keyboard: buttons }
    : undefined;

  const membershipReady =
    isMembershipReadyEvent(notification.eventType) && Boolean(payload.teamId);

  if (membershipReady && payload.teamId) {
    try {
      await bot.api.setChatMenuButton({
        chat_id: notification.recipientTelegramUserId,
        menu_button: { type: "default" },
      });
    } catch (err) {
      logError(
        `[notifications] failed to configure menu for user ${notification.recipientTelegramUserId}`,
        err instanceof Error ? err : new Error(String(err)),
        { notificationId: notification.id }
      );
    }
  }

  try {
    await bot.api.sendMessage(
      notification.recipientTelegramUserId,
      text,
      membershipReady
        ? { reply_markup: MAIN_MENU_KEYBOARD }
        : replyMarkup
          ? { reply_markup: replyMarkup }
          : undefined
    );
  } catch (err) {
    logError(
      `[notifications] failed to send to user ${notification.recipientTelegramUserId}`,
      err instanceof Error ? err : new Error(String(err)),
      { notificationId: notification.id }
    );
    return;
  }

  if (membershipReady && payload.teamId) {
    try {
      await bot.api.sendMessage(
        notification.recipientTelegramUserId,
        "<b>Quick actions</b>",
        {
          reply_markup: {
            inline_keyboard: buildMembershipActionButtons(
              notification.recipientTelegramUserId,
              payload.teamId
            ),
          },
        }
      );
    } catch (err) {
      logError(
        `[notifications] failed to send follow-up actions to user ${notification.recipientTelegramUserId}`,
        err instanceof Error ? err : new Error(String(err)),
        { notificationId: notification.id }
      );
    }
  }

  await markDelivered(notification.id);
}

export {
  buildMembershipActionButtons,
  formatMessage,
  isMembershipReadyEvent,
};

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
