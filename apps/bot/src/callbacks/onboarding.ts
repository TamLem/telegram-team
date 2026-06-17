import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { getEnv } from "@telegram-team/config";

const API_BASE_URL = getEnv("API_BASE_URL", "http://localhost:3001");
const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

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

export async function onboardingCallback(
  ctx: BotContext,
  match: RegExpMatchArray | null
): Promise<void> {
  const data = ctx.callbackData;
  if (!data) return;

  const [, action, ...rest] = data.split(":");

  if (action === "create") {
    ctx.setState("onboarding", "awaiting_team_name");
    await ctx.editMessageText(
      "Great! What would you like to name your team?\n\nJust send me the team name.",
      { reply_markup: { inline_keyboard: [] } }
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "join") {
    ctx.setState("onboarding", "awaiting_invite_code");
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
      const { request } = await apiFetch<{ request: { userId: string; teamId: string } }>(
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
        await ctx.reply(
          `Your join request for <b>${teams[0].name}</b> has been approved! You can now use the bot.`
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
      const { request } = await apiFetch<{ request: { userId: string; teamId: string } }>(
        `/api/teams/${teamId}/join-requests/${requestId}/reject`,
        {
          method: "POST",
          headers: { "X-User-Id": apiUser.id },
        }
      );

      await ctx.editMessageText("Join request rejected.");
      await ctx.answerCallbackQuery("Rejected.");

      await ctx.reply(
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
          [{ text: "Open Kanban Board", web_app: { url: `${MINIAPP_BASE_URL}/app/board/${teams[0].id}` } }],
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
        `Share this invite code with your team members:\n\n<code>${teams[0].inviteCode}</code>\n\nThey can use /start → Join Team to enter this code.`
      );
    }
    await ctx.answerCallbackQuery();
    return;
  }
}

export async function onboardingMessageHandler(ctx: BotContext): Promise<void> {
  const state = ctx.getState<string>("onboarding");
  if (!state) return;

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

      ctx.setState("onboarding", undefined);
      ctx.setState("activeTeamId", team.id);

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{ text: "Create Task", callback_data: "onboard:newtask" }],
          [{ text: "Open Board", callback_data: "onboard:board" }],
          [{ text: "Invite Members", callback_data: "onboard:invite" }],
        ],
      };

      await ctx.reply(
        `Team created: <b>${team.name}</b>\n\n` +
          `Invite code: <code>${team.inviteCode}</code>\n\n` +
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

      ctx.setState("onboarding", undefined);

      await ctx.reply(
        "Join request sent.\n\nAn admin must approve your request before you can access the team workspace."
      );

      const { team } = await apiFetch<{ team: { createdByUserId: string; name: string } }>(
        `/api/teams/${request.teamId}`
      );

      const { requests } = await apiFetch<{
        requests: Array<{ id: string; user: { telegramUserId: number; telegramUsername: string | null; firstName: string } }>;
      }>(`/api/teams/${request.teamId}/join-requests`, {
        headers: { "X-User-Id": apiUser.id },
      });

      const pendingRequest = requests.find((r) => r.user.telegramUserId === from.id);

      if (pendingRequest) {
          const adminKeyboard: InlineKeyboardMarkup = {
            inline_keyboard: [
              [
                { text: "Approve", callback_data: `onboard:approve:${request.teamId}:${pendingRequest.id}` },
                { text: "Reject", callback_data: `onboard:reject:${request.teamId}:${pendingRequest.id}` },
              ],
            ],
          };

        await ctx.reply(
          `New join request for <b>${team.name}</b>:\n\n` +
            `User: ${from.first_name}${from.username ? ` (@${from.username})` : ""}\n\n` +
            `Admins: please approve or reject this request.`,
          { reply_markup: adminKeyboard }
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      await ctx.reply(`Failed to send join request: ${message}. Please try again.`);
      ctx.setState("onboarding", undefined);
    }
    return;
  }
}
