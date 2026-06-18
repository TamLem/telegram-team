import {
  createSignedMiniAppContext,
  type MiniAppAction,
} from "@telegram-team/shared";

function actionToPath(action: MiniAppAction, ctx: {
  teamId?: string;
  taskId?: string;
}): string {
  switch (action) {
    case "create_task":
      return "/app/tasks/new";
    case "view_task":
      return `/app/tasks/${ctx.taskId}`;
    case "edit_task":
      return `/app/tasks/${ctx.taskId}/edit`;
    case "assign_task":
      return `/app/tasks/${ctx.taskId}/assign`;
    case "change_status":
      return `/app/tasks/${ctx.taskId}/status`;
    case "add_comment":
      return `/app/tasks/${ctx.taskId}/comment`;
    case "view_board":
      return `/app/board/${ctx.teamId}`;
    case "view_my_tasks":
      return "/app/tasks/mine";
    case "onboard_create_team":
      return "/app/onboarding/create-team";
    case "onboard_join_team":
      return "/app/onboarding/join-team";
    default:
      return "/app/tasks/mine";
  }
}

export function miniAppContextUrl(
  baseUrl: string,
  input: {
    action: MiniAppAction;
    telegramUserId: number;
    teamId?: string;
    returnChatId: number;
    taskId?: string;
    ttlSeconds?: number;
  }
): string {
  const token = createSignedMiniAppContext(input);
  const path = actionToPath(input.action, {
    teamId: input.teamId,
    taskId: input.taskId,
  });
  const url = new URL(path, baseUrl);
  url.searchParams.set("ctx", token);
  return url.toString();
}
