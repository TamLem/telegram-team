import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import {
  syncUser,
  listTeamChores,
  listMyChores,
  type ChoreItem,
} from "../apiClient.js";
import { escapeHtml } from "../telegram/html.js";
import { getEnv } from "@telegram-team/config";
import { miniAppContextUrl } from "../telegram/webApp.js";
import {
  loadUserTeams,
  resolveCommandTeam,
  appendSwitchRow,
} from "../teamContext.js";
import { formatChoreInterval } from "@telegram-team/shared";

const MINIAPP_BASE_URL = getEnv("MINIAPP_BASE_URL", "http://localhost:3002");

function formatDue(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d <= now) return "Due now";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export async function choresCommand(
  ctx: BotContext,
  options?: { teamId?: string }
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const chatId = ctx.chatId;
  if (!chatId) return;

  const apiUser = await syncUser(from);
  const { teams, preferredTeamId } = await loadUserTeams(apiUser.id);

  if (teams.length === 0) {
    await ctx.reply(
      "You need a team before using chores.\n\nUse /start to get started."
    );
    return;
  }

  const team =
    (options?.teamId
      ? teams.find((t) => t.id === options.teamId)
      : null) ?? resolveCommandTeam(teams, preferredTeamId);

  if (!team) {
    await ctx.reply("No team available.");
    return;
  }

  let mine: ChoreItem[] = [];
  let teamChores: ChoreItem[] = [];
  try {
    [mine, teamChores] = await Promise.all([
      listMyChores(apiUser.id),
      listTeamChores(team.id, apiUser.id),
    ]);
  } catch {
    await ctx.reply("Could not load chores. Try again later.");
    return;
  }

  const now = new Date().toISOString();
  const myDue = mine.filter((c) => c.nextDueAt <= now);
  const myUpcoming = mine
    .filter((c) => c.nextDueAt > now)
    .slice(0, 5);
  const teamActive = teamChores.filter((c) => c.active === 1);
  const teamDue = teamActive.filter((c) => c.nextDueAt <= now);

  const lines: string[] = [
    `<b>Chores</b>`,
    "",
    `<b>👤 Yours</b> · ${myDue.length} due · ${mine.length} active`,
  ];

  if (myDue.length > 0) {
    for (const c of myDue.slice(0, 8)) {
      const teamLabel = c.teamName ? ` · ${escapeHtml(c.teamName)}` : "";
      lines.push(
        `• ${escapeHtml(c.title)}${teamLabel} · ${formatChoreInterval(c.interval, c.intervalDays)}`
      );
    }
  } else if (mine.length === 0) {
    lines.push("<i>Nothing assigned to you right now.</i>");
  }

  if (myUpcoming.length > 0 && myDue.length === 0) {
    lines.push("", "<b>Coming up for you</b>");
    for (const c of myUpcoming) {
      const teamLabel = c.teamName ? ` · ${escapeHtml(c.teamName)}` : "";
      lines.push(
        `• ${escapeHtml(c.title)}${teamLabel} · next ${formatDue(c.nextDueAt)}`
      );
    }
  }

  lines.push(
    "",
    `<b>◉ ${escapeHtml(team.name)}</b> · ${teamDue.length} due · ${teamActive.length} active`
  );
  if (teamActive.length === 0) {
    lines.push("<i>No active team chores yet.</i>");
  } else if (teamDue.length > 0) {
    for (const c of teamDue.slice(0, 5)) {
      lines.push(
        `• ${escapeHtml(c.title)}` +
          (c.assigneeName ? ` · ${escapeHtml(c.assigneeName)}` : "")
      );
    }
  }

  const mineOpen = new URL("/app/chores", MINIAPP_BASE_URL);
  mineOpen.searchParams.set("view", "mine");

  const teamOpen = miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "view_chores",
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  });

  let keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "👤 My chores", web_app: { url: mineOpen.toString() } },
        { text: "◉ Team board", web_app: { url: teamOpen } },
      ],
    ],
  };
  keyboard = appendSwitchRow(keyboard, "chores", teams.length > 1);

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
