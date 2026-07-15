import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { validateTelegramLoginWidget } from "./validateTelegramLoginWidget.js";

const BOT_TOKEN = "123456:test-token";

function signLoginData(
  input: Record<string, string>
): Record<string, string> {
  const dataCheckString = Object.entries(input)
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHash("sha256").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return { ...input, hash };
}

test("validateTelegramLoginWidget accepts fresh signed data", () => {
  const now = 1_800_000_000;
  const signed = signLoginData({
    id: "123",
    first_name: "Ada",
    username: "ada",
    auth_date: String(now),
  });

  const result = validateTelegramLoginWidget(signed, BOT_TOKEN, { now });

  assert.equal(result.valid, true);
  assert.equal(result.user?.id, 123);
  assert.equal(result.user?.first_name, "Ada");
  assert.equal(result.user?.username, "ada");
});

test("validateTelegramLoginWidget rejects tampered data", () => {
  const now = 1_800_000_000;
  const signed = signLoginData({
    id: "123",
    first_name: "Ada",
    auth_date: String(now),
  });
  signed.first_name = "Eve";

  const result = validateTelegramLoginWidget(signed, BOT_TOKEN, { now });
  assert.equal(result.valid, false);
});

test("validateTelegramLoginWidget rejects expired auth_date", () => {
  const now = 1_800_000_000;
  const signed = signLoginData({
    id: "123",
    first_name: "Ada",
    auth_date: String(now - 90_000),
  });

  const result = validateTelegramLoginWidget(signed, BOT_TOKEN, {
    now,
    maxAgeSeconds: 60,
  });
  assert.equal(result.valid, false);
});

test("validateTelegramLoginWidget rejects missing hash", () => {
  const result = validateTelegramLoginWidget(
    {
      id: "123",
      first_name: "Ada",
      auth_date: String(Math.floor(Date.now() / 1000)),
    },
    BOT_TOKEN
  );
  assert.equal(result.valid, false);
});

test("validateTelegramLoginWidget does not accept Mini App initData hash scheme", () => {
  const now = 1_800_000_000;
  const input = {
    id: "123",
    first_name: "Ada",
    auth_date: String(now),
  };
  const dataCheckString = Object.entries(input)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  // Wrong scheme: WebAppData HMAC (Mini App), not SHA256(bot_token)
  const secretKey = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const result = validateTelegramLoginWidget(
    { ...input, hash },
    BOT_TOKEN,
    { now }
  );
  assert.equal(result.valid, false);
});
