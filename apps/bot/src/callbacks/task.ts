import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

async function syncUser(user: { id: number; first_name: string; last_name?: string; username?: string }) {
  const res = await fetch(`${API_BASE_URL}/api/users/telegram/${user.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramUserId: user.id,
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      telegramUsername: user.username ?? null,
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  const { user: apiUser } = (await res.json()) as { user: { id: string } };
  return apiUser;
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
    `<b>Task:</b> ${task.title}\n` +
    `<b>Status:</b> ${status}\n` +
    `<b>Priority:</b> ${priority}\n` +
    `<b>Assigned:</b> ${assigned}\n` +
    `<b>Due:</b> ${due}\n`
  );
}

function statusKeyboard(taskId: string, currentStatus: string): InlineKeyboardMarkup {
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

  return {
    inline_keyboard: [
      buttons,
      [{ text: "Open Details", web_app: { url: `${MINIAPP_BASE_URL}/app/tasks/${taskId}` } }],
    ],
  };
}

export async function taskCallback(
  ctx: BotContext,
  match: RegExpMatchArray | null
): Promise<void> {
  if (!match) return;

  const from = ctx.from;
  if (!from) return;

  const parts = match[0].split(":");
  const action = parts[1];
  const subAction = parts[2];
  const taskId = parts[3];

  if (!taskId) return;

  const apiUser = await syncUser(from);

  if (action === "status" && subAction) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": apiUser.id,
      },
      body: JSON.stringify({ status: subAction }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      await ctx.answerCallbackQuery(err.error ?? "Failed to update");
      return;
    }

    const { task } = (await res.json()) as {
      task: {
        id: string;
        title: string;
        status: string;
        priority: string;
        assignedToUserId: string | null;
        dueAt: string | null;
      };
    };

    const card = buildTaskCard(task);
    const keyboard = statusKeyboard(task.id, task.status);

    await ctx.editMessageText(card, { reply_markup: keyboard });
    await ctx.answerCallbackQuery(`Marked as ${STATUS_LABELS[subAction] ?? subAction}`);
    return;
  }

  if (action === "done" && taskId) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": apiUser.id,
      },
      body: JSON.stringify({ status: "done" }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      await ctx.answerCallbackQuery(err.error ?? "Failed to update task");
      return;
    }

    const { task } = (await res.json()) as {
      task: {
        id: string;
        title: string;
        status: string;
        priority: string;
        assignedToUserId: string | null;
        dueAt: string | null;
      };
    };

    await ctx.editMessageText(
      buildTaskCard(task),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Open Details", web_app: { url: `${MINIAPP_BASE_URL}/app/tasks/${task.id}` } }],
          ],
        },
      }
    );

    await ctx.answerCallbackQuery("Marked as done!");
    return;
  }

  if (action === "open" && taskId) {
    await ctx.reply(
      `Tap below to open this task in the Mini App:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Open Task", web_app: { url: `${MINIAPP_BASE_URL}/app/tasks/${taskId}` } }],
          ],
        },
      }
    );
    await ctx.answerCallbackQuery();
    return;
  }
}
