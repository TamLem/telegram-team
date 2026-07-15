import {
  createSignedMiniAppContext,
  type MiniAppAction,
} from "@telegram-team/shared";

export function miniAppRootUrl(baseUrl: string): string {
  return new URL("/app", baseUrl).toString();
}

function actionToPath(action: MiniAppAction, ctx: {
  teamId?: string;
  taskId?: string;
  choreId?: string;
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
      return `/app/board/${ctx.teamId}?assignee=me`;
    case "onboard_create_team":
      return "/app/onboarding/create-team";
    case "onboard_join_team":
      return "/app/onboarding/join-team";
    case "view_team":
      return "/app/team";
    case "view_members":
      return "/app/team/members";
    case "manage_invite":
      return "/app/team/invite";
    case "review_join_requests":
      return "/app/team/join-requests";
    case "team_settings":
      return "/app/team/settings";
    case "view_blocked_tasks":
      return `/app/board/${ctx.teamId}?status=blocked`;
    case "view_chores":
      return "/app/chores";
    case "view_chore":
      return ctx.choreId ? `/app/chores/${ctx.choreId}` : "/app/chores";
    default:
      return `/app/board/${ctx.teamId}?assignee=me`;
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
    choreId?: string;
    ttlSeconds?: number;
  }
): string {
  const token = createSignedMiniAppContext(input);
  const path = actionToPath(input.action, {
    teamId: input.teamId,
    taskId: input.taskId,
    choreId: input.choreId,
  });
  const url = new URL(path, baseUrl);
  url.searchParams.set("ctx", token);
  return url.toString();
}
