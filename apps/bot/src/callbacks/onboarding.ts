import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { syncUser, getActiveTeams, apiFetch } from "../apiClient.js";
import { escapeHtml } from "../telegram/html.js";
import { miniAppContextUrl } from "../telegram/webApp.js";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

async function getAdminContacts(
  userId: string,
  teamId: string,
  requestId: string
) {
  const { admins } = await apiFetch<{
    admins: Array<{
      telegramUserId: number;
      telegramUsername: string | null;
      firstName: string;
    }>;
  }>(`/api/teams/${teamId}/admin-contacts?request_id=${requestId}`, {
    headers: { "X-User-Id": userId },
  });
  return admins;
}

export async function onboardingCallback(
  ctx: BotContext,
  _match: RegExpMatchArray | null
): Promise<void> {
  const data = ctx.callbackData;
  if (!data) return;

  const [, action, ...rest] = data.split(":");

  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  if (action === "create") {
    const apiUser = await syncUser(from);
    try {
      const { team } = await apiFetch<{ team: { id: string; name: string; inviteCode: string } }>(
        "/api/teams",
        {
          method: "POST",
          headers: { "X-User-Id": apiUser.id },
          body: JSON.stringify({ name: `${from.first_name}'s Team` }),
        }
      );

      const newTaskUrl = miniAppContextUrl(MINIAPP_BASE_URL, {
        action: "create_task",
        telegramUserId: from.id,
        teamId: team.id,
        returnChatId: chatId,
      });

      const boardUrl = miniAppContextUrl(MINIAPP_BASE_URL, {
        action: "view_board",
        telegramUserId: from.id,
        teamId: team.id,
        returnChatId: chatId,
      });

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{ text: "Create Task", web_app: { url: newTaskUrl } }],
          [{ text: "Open Board", web_app: { url: boardUrl } }],
        ],
      };

      await ctx.editMessageText(
        `Team created: <b>${escapeHtml(team.name)}</b>\n\n` +
          `Invite code: <code>${escapeHtml(team.inviteCode)}</code>\n\n` +
          `You can now create tasks or open the team board.`,
        { reply_markup: keyboard }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      await ctx.editMessageText(`Failed to create team: ${message}.`);
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "join") {
    await ctx.editMessageText(
      "Please send me the invite code for the team you want to join."
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "approve") {
    const teamId = rest[0];
    const requestId = rest[1];

    const apiUser = await syncUser(from);

    try {
      const { request, user } = await apiFetch<{
        request: { userId: string; teamId: string };
        user: { telegramUserId: number };
      }>(`/api/teams/${teamId}/join-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "X-User-Id": apiUser.id },
      });

      await ctx.editMessageText(
        "Join request approved. The user is now a team member."
      );
      await ctx.answerCallbackQuery("Approved!");

      const teams = await getActiveTeams(request.userId);
      if (teams.length > 0) {
        await ctx.bot.api.sendMessage(
          user.telegramUserId,
          `Your join request for <b>${escapeHtml(teams[0].name)}</b> has been approved! You can now use the bot.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      await ctx.answerCallbackQuery(`Error: ${message}`);
    }
    return;
  }

  if (action === "reject") {
    const teamId = rest[0];
    const requestId = rest[1];
    const apiUser = await syncUser(from);

    try {
      const { user } = await apiFetch<{
        request: { userId: string; teamId: string };
        user: { telegramUserId: number };
      }>(`/api/teams/${teamId}/join-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "X-User-Id": apiUser.id },
      });

      await ctx.editMessageText("Join request rejected.");
      await ctx.answerCallbackQuery("Rejected.");

      await ctx.bot.api.sendMessage(
        user.telegramUserId,
        "Your join request has been rejected. Use /start to try again."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      await ctx.answerCallbackQuery(`Error: ${message}`);
    }
    return;
  }

  if (action === "board") {
    const apiUser = await syncUser(from);
    const teams = await getActiveTeams(apiUser.id);
    if (teams.length > 0) {
      const url = miniAppContextUrl(MINIAPP_BASE_URL, {
        action: "view_board",
        telegramUserId: from.id,
        teamId: teams[0].id,
        returnChatId: chatId,
      });
      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [[{ text: "Open Kanban Board", web_app: { url } }]],
      };
      await ctx.reply("Tap below to open the board:", {
        reply_markup: keyboard,
      });
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "invite") {
    const apiUser = await syncUser(from);
    const teams = await getActiveTeams(apiUser.id);
    if (teams.length > 0) {
      await ctx.reply(
        `Share this invite code with your team members:\n\n<code>${escapeHtml(teams[0].inviteCode)}</code>\n\nThey can use /start → Join Team to enter this code.`
      );
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "newtask") {
    const apiUser = await syncUser(from);
    const teams = await getActiveTeams(apiUser.id);
    if (teams.length === 0) {
      await ctx.answerCallbackQuery("Create a team first.");
      return;
    }
    const url = miniAppContextUrl(MINIAPP_BASE_URL, {
      action: "create_task",
      telegramUserId: from.id,
      teamId: teams[0].id,
      returnChatId: chatId,
    });
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[{ text: "Open Task Form", web_app: { url } }]],
    };
    await ctx.reply("Tap below to create a task:", { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
    return;
  }
}

export async function onboardingMessageHandler(ctx: BotContext): Promise<void> {
  const text = ctx.text;
  if (!text || text.startsWith("/")) return;

  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const inviteCode = text.trim().toUpperCase();

  if (inviteCode.length < 3) {
    await ctx.reply("That doesn't look like a valid invite code. Please try again.");
    return;
  }

  const apiUser = await syncUser(from);

  try {
    const { request } = await apiFetch<{ request: { id: string; teamId: string } }>(
      "/api/teams/join",
      {
        method: "POST",
        headers: { "X-User-Id": apiUser.id },
        body: JSON.stringify({ inviteCode }),
      }
    );

    await ctx.reply(
      "Join request sent.\n\nAn admin must approve your request before you can access the team workspace."
    );

    const { team } = await apiFetch<{ team: { createdByUserId: string; name: string } }>(
      `/api/teams/${request.teamId}?request_id=${request.id}`,
      { headers: { "X-User-Id": apiUser.id } }
    );

    const admins = await getAdminContacts(apiUser.id, request.teamId, request.id);
    const adminKeyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: "Approve", callback_data: `onboard:approve:${request.teamId}:${request.id}` },
          { text: "Reject", callback_data: `onboard:reject:${request.teamId}:${request.id}` },
        ],
      ],
    };

    await Promise.all(
      admins.map((admin) =>
        ctx.bot.api.sendMessage(
          admin.telegramUserId,
          `New join request for <b>${escapeHtml(team.name)}</b>:\n\n` +
            `User: ${escapeHtml(from.first_name)}${from.username ? ` (@${escapeHtml(from.username)})` : ""}\n\n` +
            `Approve or reject this request.`,
          { reply_markup: adminKeyboard }
        )
      )
    );

    if (admins.length === 0) {
      await ctx.reply(
        "No team admins could be notified. Ask a team admin to open the app and review pending requests."
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    await ctx.reply(`Failed to send join request: ${message}. Please try again.`);
  }
}
