import type { BotContext } from "@telegram-team/bot-engine";
import type { InlineKeyboardMarkup } from "@telegram-team/bot-engine";
import { syncUser, listTeamChores, type ChoreItem } from "../apiClient.js";
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

  let chores: ChoreItem[] = [];
  try {
    chores = await listTeamChores(team.id, apiUser.id);
  } catch {
    await ctx.reply("Could not load chores. Try again later.");
    return;
  }

  const active = chores.filter((c) => c.active === 1);
  const now = new Date().toISOString();
  const due = active.filter((c) => c.nextDueAt <= now);
  const upcoming = active.filter((c) => c.nextDueAt > now).slice(0, 5);

  const lines: string[] = [
    `<b>Chores · ${escapeHtml(team.name)}</b>`,
    "",
    `Due: ${due.length} · Active: ${active.length}`,
  ];

  if (due.length > 0) {
    lines.push("", "<b>Due now</b>");
    for (const c of due.slice(0, 8)) {
      lines.push(
        `• ${escapeHtml(c.title)} · ${formatChoreInterval(c.interval, c.intervalDays)}` +
          (c.assigneeName ? ` · ${escapeHtml(c.assigneeName)}` : "")
      );
    }
  }

  if (upcoming.length > 0) {
    lines.push("", "<b>Upcoming</b>");
    for (const c of upcoming) {
      lines.push(
        `• ${escapeHtml(c.title)} · next ${formatDue(c.nextDueAt)}` +
          ` (${formatChoreInterval(c.interval, c.intervalDays)})`
      );
    }
  }

  if (active.length === 0) {
    lines.push("", "No active chores yet. Open the Mini App to create one.");
  }

  const openUrl = miniAppContextUrl(MINIAPP_BASE_URL, {
    action: "view_chores",
    telegramUserId: from.id,
    teamId: team.id,
    returnChatId: chatId,
  });

  let keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: "Open Chores", web_app: { url: openUrl } }]],
  };
  keyboard = appendSwitchRow(keyboard, "chores", teams.length > 1);

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
