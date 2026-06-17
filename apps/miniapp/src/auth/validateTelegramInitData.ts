import { createHmac } from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export function validateTelegramInitData(
  initData: string,
  botToken: string
): { valid: boolean; user?: TelegramUser } {
  const params = new URLSearchParams(initData);

  const hash = params.get("hash");
  if (!hash) return { valid: false };

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    return { valid: false };
  }

  const userStr = params.get("user");
  if (!userStr) return { valid: false };

  const user = JSON.parse(userStr) as TelegramUser;
  return { valid: true, user };
}
