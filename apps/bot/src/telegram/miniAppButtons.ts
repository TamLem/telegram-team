import type { InlineKeyboardButton } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { miniAppContextUrl } from "./webApp.js";
import type { MiniAppAction } from "@telegram-team/shared";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

export interface MiniAppButtonParams {
  telegramUserId: number;
  teamId: string;
  returnChatId: number;
  taskId?: string;
}

function buildButton(text: string, url: string): InlineKeyboardButton {
  return { text, web_app: { url } };
}

function buildUrl(action: MiniAppAction, params: MiniAppButtonParams): string {
  return miniAppContextUrl(MINIAPP_BASE_URL, {
    action,
    telegramUserId: params.telegramUserId,
    teamId: params.teamId,
    returnChatId: params.returnChatId,
    taskId: params.taskId,
  });
}

export function buildCreateTaskButton(params: MiniAppButtonParams): InlineKeyboardButton {
  return buildButton("Open Task Form", buildUrl("create_task", params));
}

export function buildMyTasksButton(params: MiniAppButtonParams): InlineKeyboardButton {
  return buildButton("Open My Tasks", buildUrl("view_my_tasks", params));
}

export function buildBoardButton(params: MiniAppButtonParams): InlineKeyboardButton {
  return buildButton("Open Team Board", buildUrl("view_board", params));
}

export function buildTaskDetailButton(params: MiniAppButtonParams): InlineKeyboardButton {
  return buildButton("Open Details", buildUrl("view_task", { ...params, taskId: params.taskId }));
}

export function buildEditTaskButton(params: MiniAppButtonParams): InlineKeyboardButton {
  return buildButton("Edit Task", buildUrl("edit_task", { ...params, taskId: params.taskId }));
}

export function buildAssignTaskButton(params: MiniAppButtonParams): InlineKeyboardButton {
  return buildButton("Assign Task", buildUrl("assign_task", { ...params, taskId: params.taskId }));
}

export function buildChangeStatusButton(params: MiniAppButtonParams): InlineKeyboardButton {
  return buildButton("Change Status", buildUrl("change_status", { ...params, taskId: params.taskId }));
}

export function buildAddCommentButton(params: MiniAppButtonParams): InlineKeyboardButton {
  return buildButton("Add Comment", buildUrl("add_comment", { ...params, taskId: params.taskId }));
}

export function buildCreateTeamButton(params: Omit<MiniAppButtonParams, "teamId">): InlineKeyboardButton {
  const url = miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "onboard_create_team",
    telegramUserId: params.telegramUserId,
    returnChatId: params.returnChatId,
  });
  return buildButton("Create Team", url);
}

export function buildJoinTeamButton(params: Omit<MiniAppButtonParams, "teamId">): InlineKeyboardButton {
  const url = miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "onboard_join_team",
    telegramUserId: params.telegramUserId,
    returnChatId: params.returnChatId,
  });
  return buildButton("Join Team", url);
}
