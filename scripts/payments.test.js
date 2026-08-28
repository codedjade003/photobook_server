/* eslint-disable no-console */
// Unit tests for core payment logic (no network, no DB).
// Run with: npm run test:payments
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

process.env.PAYSTACK_WEBHOOK_SECRET = "test-whsec-for-unit-tests";

const {
  buildPaymentReference,
  buildTransferReference,
  computePayoutAmount,
  computePlatformFee,
  koboToNaira,
  maskAccountNumber,
  nairaToKobo,
  verifyWebhookSignature
} = await import("../src/config/payments.js");

// ── 70/30 split ──────────────────────────────────────────────
test("computePayoutAmount returns 70% of agreed amount", () => {
  assert.equal(computePayoutAmount(100000), 70000);
  assert.equal(computePayoutAmount(50000), 35000);
  assert.equal(computePayoutAmount(333.33), 233.33);
});

test("computePlatformFee returns 30% of agreed amount", () => {
  assert.equal(computePlatformFee(100000), 30000);
  assert.equal(computePlatformFee(0), 0);
});

test("payout + fee ≈ full amount (within floating-point tolerance)", () => {
  const agreed = 125750.75;
  const payout = computePayoutAmount(agreed);
  const fee = computePlatformFee(agreed);
  assert.ok(Math.abs(payout + fee - agreed) <= 0.02);
  assert.ok(Math.abs(payout - agreed * 0.7) <= 0.01);
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

test("verifyWebhookSignature throws when secret is not configured", () => {
  const original = process.env.PAYSTACK_WEBHOOK_SECRET;
  delete process.env.PAYSTACK_WEBHOOK_SECRET;
  try {
    assert.throws(
      () => verifyWebhookSignature({ rawBody: "{}", signature: "abc" }),
      /Webhook secret not configured/
    );
  } finally {
    process.env.PAYSTACK_WEBHOOK_SECRET = original;
  }
});

// ── Account masking ──────────────────────────────────────────
test("maskAccountNumber hides all but last 4 digits", () => {
  assert.equal(maskAccountNumber("0123456789"), "******6789");
  assert.equal(maskAccountNumber("1234"), "****34");
});
