import type { InlineKeyboardButton } from "@telegram-team/bot-engine";
import { escapeHtml } from "./html.js";
import {
  buildTaskDetailButton,
  buildEditTaskButton,
  buildAssignTaskButton,
  buildAddCommentButton,
  type MiniAppButtonParams,
} from "./miniAppButtons.js";

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

export interface TaskCardData {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName?: string | null;
  dueAt?: string | null;
  createdByName?: string;
}

export function formatDueDate(dateString: string | null | undefined): string {
  if (!dateString) return "Not set";
  const date = new Date(dateString);
  const hasTime = dateString.includes("T") && dateString.length > 10;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return hasTime ? `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Today";
  if (date.toDateString() === tomorrow.toDateString()) return hasTime ? `Tomorrow, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Tomorrow";

  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (hasTime) return `${day}, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return day;
}

export function renderTaskCard(task: TaskCardData): string {
  const status = STATUS_LABELS[task.status] ?? task.status;
  const priority = PRIORITY_LABELS[task.priority] ?? task.priority;
  const assignee = task.assigneeName ? `@${task.assigneeName}` : "Unassigned";
  const due = formatDueDate(task.dueAt);

  return (
    `<b>Task:</b> ${escapeHtml(task.title)}\n` +
    `<b>Status:</b> ${status}\n` +
    `<b>Priority:</b> ${priority}\n` +
    `<b>Assignee:</b> ${assignee}\n` +
    `<b>Due:</b> ${due}` +
    (task.createdByName ? `\n\n<b>Created by:</b> ${escapeHtml(task.createdByName)}` : "")
  );
}

export function buildTaskCardButtons(
  params: MiniAppButtonParams
): InlineKeyboardButton[][] {
  return [
    [buildTaskDetailButton(params)],
    [
      buildEditTaskButton(params),
      buildAssignTaskButton(params),
    ],
    [buildAddCommentButton(params)],
  ];
}
