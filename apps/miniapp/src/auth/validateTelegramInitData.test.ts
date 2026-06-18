import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validateTelegramInitData } from "./validateTelegramInitData.js";

const BOT_TOKEN = "123456:test-token";

function signedInitData(input: Record<string, string>): string {
  const dataCheckString = Object.entries(input)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const params = new URLSearchParams(input);
  params.set("hash", hash);
  return params.toString();
}

test("validateTelegramInitData accepts fresh signed data", () => {
  const now = 1_800_000_000;
  const result = validateTelegramInitData(
    signedInitData({
      auth_date: String(now),
      user: JSON.stringify({ id: 123, first_name: "Ada" }),
    }),
    BOT_TOKEN,
    { now }
  );

  assert.equal(result.valid, true);
  assert.equal(result.user?.id, 123);
});

test("validateTelegramInitData rejects expired signed data", () => {
  const now = 1_800_000_000;
  const result = validateTelegramInitData(
    signedInitData({
      auth_date: String(now - 90_000),
      user: JSON.stringify({ id: 123, first_name: "Ada" }),
    }),
    BOT_TOKEN,
    { now, maxAgeSeconds: 60 }
  );

  assert.equal(result.valid, false);
});

test("validateTelegramInitData rejects malformed user JSON", () => {
  const now = 1_800_000_000;
  const result = validateTelegramInitData(
    signedInitData({
      auth_date: String(now),
      user: "{not json",
    }),
    BOT_TOKEN,
    { now }
  );

  assert.equal(result.valid, false);
});
