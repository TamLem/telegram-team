import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  options: { maxAgeSeconds?: number; now?: number } = {}
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

  const hashBuffer = Buffer.from(hash, "hex");
  const computedHashBuffer = Buffer.from(computedHash, "hex");
  if (
    hashBuffer.length !== computedHashBuffer.length ||
    !timingSafeEqual(hashBuffer, computedHashBuffer)
  ) {
    return { valid: false };
  }

  const authDate = Number(params.get("auth_date"));
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

  const userStr = params.get("user");
  if (!userStr) return { valid: false };

  try {
    const user = JSON.parse(userStr) as TelegramUser;
    if (!user.id || !user.first_name) return { valid: false };
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}
