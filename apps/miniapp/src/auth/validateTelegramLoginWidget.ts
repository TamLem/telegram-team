import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { TelegramUser } from "./validateTelegramInitData.js";

/**
 * Payload fields returned by the Telegram Login Widget
 * (https://core.telegram.org/widgets/login).
 */
export interface TelegramLoginWidgetData {
  id: number | string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

/**
 * Validates Telegram Login Widget auth data.
 *
 * Secret key = SHA256(bot_token)  (unlike Mini App initData which uses
 * HMAC-SHA256("WebAppData", bot_token)).
 */
export function validateTelegramLoginWidget(
  data: TelegramLoginWidgetData | Record<string, unknown>,
  botToken: string,
  options: { maxAgeSeconds?: number; now?: number } = {}
): { valid: boolean; user?: TelegramUser } {
  const hash = typeof data.hash === "string" ? data.hash : "";
  if (!hash) return { valid: false };

  const fields: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "hash") continue;
    if (value === undefined || value === null || value === "") continue;
    fields.push([key, String(value)]);
  }

  fields.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = fields.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const hashBuffer = Buffer.from(hash, "hex");
  const computedHashBuffer = Buffer.from(computedHash, "hex");
  if (
    hashBuffer.length !== computedHashBuffer.length ||
    !timingSafeEqual(hashBuffer, computedHashBuffer)
  ) {
    return { valid: false };
  }

  const authDate = Number(data.auth_date);
  const maxAgeSeconds = options.maxAgeSeconds ?? 86_400;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(authDate) ||
    authDate <= 0 ||
    authDate > now + 60 ||
    now - authDate > maxAgeSeconds
  ) {
    return { valid: false };
  }

  const id = Number(data.id);
  const firstName =
    typeof data.first_name === "string" ? data.first_name : undefined;
  if (!Number.isFinite(id) || id <= 0 || !firstName) {
    return { valid: false };
  }

  const user: TelegramUser = {
    id,
    first_name: firstName,
  };
  if (typeof data.last_name === "string" && data.last_name) {
    user.last_name = data.last_name;
  }
  if (typeof data.username === "string" && data.username) {
    user.username = data.username;
  }
  if (typeof data.photo_url === "string" && data.photo_url) {
    user.photo_url = data.photo_url;
  }

  return { valid: true, user };
}
