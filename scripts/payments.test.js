/* eslint-disable no-console */
// Unit tests for core payment logic (no network, no DB).
// Run with: npm run test:payments
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

process.env.PAYSTACK_WEBHOOK_SECRET = "test-whsec-for-unit-tests";

const {
  PLATFORM_FEE_RATE,
  buildPaymentReference,
  buildRefundReference,
  buildTransferReference,
  computePayoutAmount,
  computePlatformFee,
  computeSplit,
  koboToNaira,
  maskAccountNumber,
  nairaToKobo,
  verifyWebhookSignature
} = await import("../src/config/payments.js");

// ── 95/5 split, fee rounded to the whole naira ───────────────
test("default platform fee rate is 5%", () => {
  assert.equal(PLATFORM_FEE_RATE, 0.05);
});

test("computePlatformFee takes 5%, rounded to the nearest naira", () => {
  assert.equal(computePlatformFee(100000), 5000);
  assert.equal(computePlatformFee(50000), 2500);
  assert.equal(computePlatformFee(0), 0);
  // 5% of 333.33 is 16.6665 → rounds up to a whole naira.
  assert.equal(computePlatformFee(333.33), 17);
  // 5% of 1050 is 52.5 → rounds to 53.
  assert.equal(computePlatformFee(1050), 53);
});

test("computePayoutAmount returns the exact remainder after the fee", () => {
  assert.equal(computePayoutAmount(100000), 95000);
  assert.equal(computePayoutAmount(50000), 47500);
  assert.equal(computePayoutAmount(333.33), 316.33);
  assert.equal(computePayoutAmount(1050), 997);
});

test("fee + payout reconciles EXACTLY to the amount collected", () => {
  for (const agreed of [100000, 50000, 1050, 333.33, 125750.75, 7, 1, 0.5, 999999.99]) {
    const fee = computePlatformFee(agreed);
    const payout = computePayoutAmount(agreed);
    const gross = Math.round(agreed * 100) / 100;
    assert.equal(
      Math.round((fee + payout) * 100) / 100,
      gross,
      `fee + payout must equal ${gross}`
    );
  }
});

test("the platform fee never exceeds the amount collected", () => {
  for (const agreed of [0.5, 1, 5, 19]) {
    assert.ok(computePlatformFee(agreed) <= agreed);
    assert.ok(computePayoutAmount(agreed) >= 0);
  }
});

test("non-positive or non-numeric amounts yield a zero split", () => {
  for (const bad of [0, -1, null, undefined, NaN, "abc"]) {
    assert.equal(computePlatformFee(bad), 0);
    assert.equal(computePayoutAmount(bad), 0);
  }
});

test("computeSplit reports gross, fee and payout together", () => {
  assert.deepEqual(computeSplit(50000), {
    gross: 50000,
    platformFee: 2500,
    payout: 47500
  });
});

test("the fee is always a whole number of naira", () => {
  for (const agreed of [333.33, 125750.75, 1050.55, 99.99, 12345.67]) {
    assert.equal(computePlatformFee(agreed) % 1, 0);
  }
});

// ── Naira ↔ kobo ─────────────────────────────────────────────
test("nairaToKobo converts to integer kobo", () => {
  assert.equal(nairaToKobo(100), 10000);
  assert.equal(nairaToKobo(49.99), 4999);
  assert.equal(nairaToKobo(0), 0);
});

test("koboToNaira converts back", () => {
  assert.equal(koboToNaira(10000), 100);
  assert.equal(koboToNaira(4999), 49.99);
});

// ── Deterministic references (idempotency) ───────────────────
test("payment reference is deterministic per session", () => {
  const sessionId = "00000000-0000-4000-8000-000000000001";
  assert.equal(buildPaymentReference(sessionId), buildPaymentReference(sessionId));
  assert.match(buildPaymentReference(sessionId), /^pbb-p-[0-9a-f]{16}$/);
});

test("transfer reference differs from payment reference and is deterministic", () => {
  const sessionId = "00000000-0000-4000-8000-000000000001";
  assert.equal(buildTransferReference(sessionId), buildTransferReference(sessionId));
  assert.match(buildTransferReference(sessionId), /^pbb-t-[0-9a-f]{16}$/);
  assert.notEqual(buildPaymentReference(sessionId), buildTransferReference(sessionId));
});

test("refund reference is deterministic and distinct from payment/transfer", () => {
  const sessionId = "00000000-0000-4000-8000-000000000001";
  assert.equal(buildRefundReference(sessionId), buildRefundReference(sessionId));
  assert.match(buildRefundReference(sessionId), /^pbb-r-[0-9a-f]{16}$/);
  assert.notEqual(buildRefundReference(sessionId), buildPaymentReference(sessionId));
  assert.notEqual(buildRefundReference(sessionId), buildTransferReference(sessionId));
});

test("references are unique across sessions", () => {
  const a = buildPaymentReference("11111111-1111-4111-8111-111111111111");
  const b = buildPaymentReference("22222222-2222-4222-8222-222222222222");
  assert.notEqual(a, b);
});

// ── Webhook signature verification ───────────────────────────
const secret = "test-whsec-for-unit-tests";
const sign = (rawBody) =>
  crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

test("verifyWebhookSignature accepts a valid signature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "pbb-p-abc" } });
  assert.equal(verifyWebhookSignature({ rawBody: body, signature: sign(body) }), true);
});

test("verifyWebhookSignature rejects a tampered body", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "pbb-p-abc" } });
  const tampered = JSON.stringify({ event: "charge.success", data: { reference: "pbb-p-ATTACK" } });
  assert.equal(verifyWebhookSignature({ rawBody: tampered, signature: sign(body) }), false);
});

test("verifyWebhookSignature rejects a missing signature", () => {
  assert.equal(verifyWebhookSignature({ rawBody: "{}", signature: undefined }), false);
});

// Paystack signs webhooks with the SECRET KEY — it issues no separate webhook
// secret. Getting this wrong silently rejects every real webhook, so escrow
// payments would never confirm.
test("verifyWebhookSignature falls back to PAYSTACK_SECRET_KEY", () => {
  const originalWebhook = process.env.PAYSTACK_WEBHOOK_SECRET;
  const originalKey = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_WEBHOOK_SECRET;
  process.env.PAYSTACK_SECRET_KEY = "sk_test_signing_key";
  try {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "pbb-p-abc" } });
    const signature = crypto
      .createHmac("sha512", "sk_test_signing_key")
      .update(body)
      .digest("hex");
    assert.equal(verifyWebhookSignature({ rawBody: body, signature }), true);
  } finally {
    process.env.PAYSTACK_WEBHOOK_SECRET = originalWebhook;
    if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = originalKey;
  }
});

test("an explicit PAYSTACK_WEBHOOK_SECRET overrides the secret key", () => {
  const originalKey = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "sk_test_a_different_key";
  try {
    const body = JSON.stringify({ event: "charge.success" });
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: sign(body) }), true);
  } finally {
    if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = originalKey;
  }
});

test("verifyWebhookSignature throws when no secret is configured at all", () => {
  const original = process.env.PAYSTACK_WEBHOOK_SECRET;
  const originalKey = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_WEBHOOK_SECRET;
  delete process.env.PAYSTACK_SECRET_KEY;
  try {
    assert.throws(
      () => verifyWebhookSignature({ rawBody: "{}", signature: "abc" }),
      /Webhook secret not configured/
    );
  } finally {
    process.env.PAYSTACK_WEBHOOK_SECRET = original;
    if (originalKey !== undefined) process.env.PAYSTACK_SECRET_KEY = originalKey;
  }
});

// ── Account masking ──────────────────────────────────────────
test("maskAccountNumber hides all but last 4 digits", () => {
  assert.equal(maskAccountNumber("0123456789"), "******6789");
  assert.equal(maskAccountNumber("1234"), "****34");
});
