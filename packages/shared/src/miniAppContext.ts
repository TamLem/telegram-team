import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export const MINIAPP_CONTEXT_DEFAULT_TTL_SECONDS = 15 * 60;

export type MiniAppAction =
  | "create_task"
  | "view_task"
  | "edit_task"
  | "assign_task"
  | "change_status"
  | "add_comment"
  | "view_board"
  | "view_my_tasks"
  | "onboard_create_team"
  | "onboard_join_team";

export interface MiniAppContext {
  action: MiniAppAction;
  telegramUserId: number;
  teamId?: string;
  returnChatId: number;
  taskId?: string;
  expiresAt: number;
  nonce: string;
}

export interface CreateMiniAppContextInput {
  action: MiniAppAction;
  telegramUserId: number;
  teamId?: string;
  returnChatId: number;
  taskId?: string;
  ttlSeconds?: number;
}

function resolveSecret(): string {
  const secret =
    process.env.MINIAPP_CONTEXT_SECRET ??
    process.env.MINIAPP_SESSION_SECRET ??
    process.env.BOT_TOKEN;
  if (!secret) {
    throw new Error(
      "Missing MINIAPP_CONTEXT_SECRET (or MINIAPP_SESSION_SECRET or BOT_TOKEN fallback)"
    );
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createSignedMiniAppContext(
  input: CreateMiniAppContextInput
): string {
  const secret = resolveSecret();
  const ttl = input.ttlSeconds ?? MINIAPP_CONTEXT_DEFAULT_TTL_SECONDS;

  const payload: MiniAppContext = {
    action: input.action,
    telegramUserId: input.telegramUserId,
    teamId: input.teamId,
    returnChatId: input.returnChatId,
    taskId: input.taskId,
    expiresAt: Math.floor(Date.now() / 1000) + ttl,
    nonce: randomBytes(8).toString("hex"),
  };

  const encoded = encodeBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySignedMiniAppContext(token: string): MiniAppContext | null {
  const secret = resolveSecret();
  if (!token) return null;

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expected = sign(encoded, secret);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encoded)) as MiniAppContext;
    const isOnboarding =
      payload.action === "onboard_create_team" ||
      payload.action === "onboard_join_team";

    if (
      !payload.action ||
      typeof payload.telegramUserId !== "number" ||
      (!isOnboarding && !payload.teamId) ||
      typeof payload.returnChatId !== "number" ||
      !payload.expiresAt ||
      !payload.nonce
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
