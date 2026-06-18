import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { syncUser, apiFetch, getActiveTeams } from "../apiClient.js";
import { escapeHtml } from "../telegram/html.js";
import { miniAppContextUrl } from "../telegram/webApp.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

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

export function parseTaskCallbackData(data: string): {
  action: string;
  subAction?: string;
  taskId?: string;
} | null {
  const parts = data.split(":");
  if (parts[0] !== "task") return null;

  const action = parts[1];
  if (!action) return null;

  if (action === "status") {
    const subAction = parts[2];
    const taskId = parts[3];
    if (!subAction || !taskId || parts.length !== 4) return null;
    return { action, subAction, taskId };
  }

  const taskId = parts[2];
  if (!taskId || parts.length !== 3) return null;
  return { action, taskId };
}

function buildTaskCard(task: {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedToUserId: string | null;
  dueAt: string | null;
}): string {
  const status = STATUS_LABELS[task.status] ?? task.status;
  const priority = PRIORITY_LABELS[task.priority] ?? task.priority;
  const assigned = task.assignedToUserId ? `Assigned` : "Unassigned";
  const due = task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "Not set";

  return (
    `<b>Task:</b> ${escapeHtml(task.title)}\n` +
    `<b>Status:</b> ${status}\n` +
    `<b>Priority:</b> ${priority}\n` +
    `<b>Assigned:</b> ${assigned}\n` +
    `<b>Due:</b> ${due}\n`
  );
}

async function buildTaskKeyboard(
  taskId: string,
  currentStatus: string,
  from: { id: number; first_name: string; last_name?: string; username?: string },
  chatId: number
): Promise<InlineKeyboardMarkup> {
  const buttons: { text: string; callback_data: string }[] = [];

  if (currentStatus === "todo") {
    buttons.push({ text: "Doing", callback_data: `task:status:doing:${taskId}` });
  }
  if (currentStatus === "todo" || currentStatus === "doing") {
    buttons.push({ text: "Blocked", callback_data: `task:status:blocked:${taskId}` });
  }
  if (currentStatus !== "done" && currentStatus !== "cancelled") {
    buttons.push({ text: "Done", callback_data: `task:status:done:${taskId}` });
  }

  const apiUser = await syncUser(from);
  const teams = await getActiveTeams(apiUser.id);
  const teamId = teams[0]?.id;

  const detailUrl = teamId
    ? miniAppContextUrl(MINIAPP_BASE_URL, {
        action: "view_task",
        telegramUserId: from.id,
        teamId,
        returnChatId: chatId,
        taskId,
      })
    : undefined;

  const rows: InlineKeyboardMarkup["inline_keyboard"] = [];
  if (buttons.length > 0) rows.push(buttons);
  if (detailUrl) rows.push([{ text: "Open Details", web_app: { url: detailUrl } }]);

  return { inline_keyboard: rows };
}

export async function taskCallback(
  ctx: BotContext,
  _match: RegExpMatchArray | null
): Promise<void> {
  const data = ctx.callbackData;
  if (!data) {
    await ctx.answerCallbackQuery("Unsupported task action");
    return;
  }

  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const parsed = parseTaskCallbackData(data);
  if (!parsed?.taskId) {
    await ctx.answerCallbackQuery("Unsupported task action");
    return;
  }

  const { action, subAction, taskId } = parsed;

  const apiUser = await syncUser(from);

  if (action === "status" && subAction) {
    try {
      const { task } = await apiFetch<{
        task: {
          id: string;
          title: string;
          status: string;
          priority: string;
          assignedToUserId: string | null;
          dueAt: string | null;
        };
      }>(`/api/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "X-User-Id": apiUser.id },
        body: JSON.stringify({ status: subAction }),
      });

      const card = buildTaskCard(task);
      const keyboard = await buildTaskKeyboard(task.id, task.status, from, chatId);

      await ctx.editMessageText(card, { reply_markup: keyboard });
      await ctx.answerCallbackQuery(`Marked as ${STATUS_LABELS[subAction] ?? subAction}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update";
      await ctx.answerCallbackQuery(message);
    }
    return;
  }

  if (action === "done" && taskId) {
    try {
      const { task } = await apiFetch<{
        task: {
          id: string;
          title: string;
          status: string;
          priority: string;
          assignedToUserId: string | null;
          dueAt: string | null;
        };
      }>(`/api/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "X-User-Id": apiUser.id },
        body: JSON.stringify({ status: "done" }),
      });

      const keyboard = await buildTaskKeyboard(task.id, task.status, from, chatId);
      await ctx.editMessageText(buildTaskCard(task), { reply_markup: keyboard });
      await ctx.answerCallbackQuery("Marked as done!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update task";
      await ctx.answerCallbackQuery(message);
    }
    return;
  }

  if (action === "open" && taskId) {
    const teams = await getActiveTeams(apiUser.id);
    if (teams.length === 0) {
      await ctx.answerCallbackQuery("No team found");
      return;
    }
    const url = miniAppContextUrl(MINIAPP_BASE_URL, {
      action: "view_task",
      telegramUserId: from.id,
      teamId: teams[0].id,
      returnChatId: chatId,
      taskId,
    });
    await ctx.reply(`Tap below to open this task:`, {
      reply_markup: {
        inline_keyboard: [[{ text: "Open Task", web_app: { url } }]],
      },
    });
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery("Unsupported task action");
}
