import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";
import { escapeHtml } from "../telegram/html.js";
import { miniAppLaunchUrl } from "../telegram/webApp.js";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

const conversationStates = new Map<number, { state: string; data?: Record<string, string> }>();
const userState = new Map<number, Record<string, string>>();

export function getUserState(chatId: number, key: string): string | undefined {
  return userState.get(chatId)?.[key];
}

export function setUserState(chatId: number, key: string, value: string): void {
  const existing = userState.get(chatId) ?? {};
  existing[key] = value;
  userState.set(chatId, existing);
}

function getConvo(chatId: number) {
  return conversationStates.get(chatId);
}

function setConvo(chatId: number, state: string, data?: Record<string, string>) {
  conversationStates.set(chatId, { state, data });
}

function clearConvo(chatId: number) {
  conversationStates.delete(chatId);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function syncUser(user: { id: number; first_name: string; last_name?: string; username?: string }) {
  const { user: apiUser } = await apiFetch<{ user: { id: string } }>(
    `/api/users/telegram/${user.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        telegramUserId: user.id,
        firstName: user.first_name,
        lastName: user.last_name ?? null,
        telegramUsername: user.username ?? null,
      }),
    }
  );
  return apiUser;
}

async function getActiveTeams(userId: string) {
  try {
    const { teams } = await apiFetch<{ teams: Array<{ id: string; name: string; inviteCode: string; role: string }> }>(
      `/api/me/teams`,
      { headers: { "X-User-Id": userId } }
    );
    return teams;
  } catch {
    return [];
  }
}

async function getAdminContacts(userId: string, teamId: string, requestId: string) {
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
  match: RegExpMatchArray | null
): Promise<void> {
  const data = ctx.callbackData;
  if (!data) return;

  const [, action, ...rest] = data.split(":");

  if (action === "create") {
    const chatId = ctx.chatId;
    if (!chatId) return;
    setConvo(chatId, "awaiting_team_name");
    await ctx.editMessageText(
      "Great! What would you like to name your team?\n\nJust send me the team name.",
      { reply_markup: { inline_keyboard: [] } }
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "join") {
    const chatId = ctx.chatId;
    if (!chatId) return;
    setConvo(chatId, "awaiting_invite_code");
    await ctx.editMessageText(
      "Please send me the invite code for the team you want to join.",
      { reply_markup: { inline_keyboard: [] } }
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "approve") {
    const teamId = rest[0];
    const requestId = rest[1];

    const from = ctx.from;
    if (!from) return;

    const apiUser = await syncUser(from);

    try {
      const { request, user } = await apiFetch<{
        request: { userId: string; teamId: string };
        user: { telegramUserId: number };
      }>(
        `/api/teams/${teamId}/join-requests/${requestId}/approve`,
        {
          method: "POST",
          headers: { "X-User-Id": apiUser.id },
        }
      );

      await ctx.editMessageText("Join request approved. The user is now a team member.");
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
    const from = ctx.from;
    if (!from) return;

    const apiUser = await syncUser(from);

    try {
      const { request, user } = await apiFetch<{
        request: { userId: string; teamId: string };
        user: { telegramUserId: number };
      }>(
        `/api/teams/${teamId}/join-requests/${requestId}/reject`,
        {
          method: "POST",
          headers: { "X-User-Id": apiUser.id },
        }
      );

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

  if (action === "newtask") {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use <code>/newtask &lt;title&gt;</code> to create a task.\n\nExample:\n/newtask Prepare quarterly report");
    return;
  }

  if (action === "board") {
    const from = ctx.from;
    if (!from) return;
    const apiUser = await syncUser(from);
    const teams = await getActiveTeams(apiUser.id);
    if (teams.length > 0) {
      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            {
              text: "Open Kanban Board",
              web_app: {
                url: miniAppLaunchUrl(
                  MINIAPP_BASE_URL,
                  `/app/board/${teams[0].id}`
                ),
              },
            },
          ],
        ],
      };
      await ctx.reply("Tap below to open the board:", {
        reply_markup: keyboard,
      });
    }
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "invite") {
    const from = ctx.from;
    if (!from) return;
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
}

export async function onboardingMessageHandler(ctx: BotContext): Promise<void> {
  const chatId = ctx.chatId;
  if (!chatId) return;

  const convo = getConvo(chatId);
  if (!convo) return;

  const state = convo.state;

  const text = ctx.text;
  if (!text || text.startsWith("/")) return;

  const from = ctx.from;
  if (!from) return;

  const apiUser = await syncUser(from);

  if (state === "awaiting_team_name") {
    const teamName = text.trim();
    if (teamName.length < 1 || teamName.length > 100) {
      await ctx.reply("Team name must be between 1 and 100 characters. Try again:");
      return;
    }

    try {
      const { team } = await apiFetch<{ team: { id: string; name: string; inviteCode: string } }>(
        "/api/teams",
        {
          method: "POST",
          headers: { "X-User-Id": apiUser.id },
          body: JSON.stringify({ name: teamName }),
        }
      );

      clearConvo(chatId);

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{ text: "Create Task", callback_data: "onboard:newtask" }],
          [{ text: "Open Board", callback_data: "onboard:board" }],
          [{ text: "Invite Members", callback_data: "onboard:invite" }],
        ],
      };

      await ctx.reply(
        `Team created: <b>${escapeHtml(team.name)}</b>\n\n` +
          `Invite code: <code>${escapeHtml(team.inviteCode)}</code>\n\n` +
          `You can now create tasks, invite members, or open the team board.`,
        { reply_markup: keyboard }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      await ctx.reply(`Failed to create team: ${message}. Please try again.`);
    }
    return;
  }

  if (state === "awaiting_invite_code") {
    const inviteCode = text.trim().toUpperCase();

    try {
      const { request } = await apiFetch<{ request: { id: string; teamId: string } }>(
        "/api/teams/join",
        {
          method: "POST",
          headers: { "X-User-Id": apiUser.id },
          body: JSON.stringify({ inviteCode }),
        }
      );

      clearConvo(chatId);

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
      clearConvo(chatId);
    }
    return;
  }
}
