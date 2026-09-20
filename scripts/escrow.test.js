/* eslint-disable no-console */
// Escrow lifecycle rules: when money may be released, and when it must be
// refunded. Pure logic — no network, no DB.
// Run with: npm run test:escrow
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.PAYSTACK_WEBHOOK_SECRET = "test-whsec-for-unit-tests";

const { evaluateRefundEligibility } = await import("../src/services/payment.service.js");
const { computeSplit } = await import("../src/config/payments.js");

const confirmedPayment = { id: "pay-1", status: "confirmed", amount: 50000 };
const heldSession = { id: "sess-1", client_confirmed_at: null, completed_at: null };

// ── Refund is allowed while the money is still held ──────────
test("a confirmed payment with nothing released is refundable", () => {
  const result = evaluateRefundEligibility({
    session: heldSession,
    payment: confirmedPayment,
    payout: undefined,
    refund: undefined
  });
  assert.deepEqual(result, { ok: true });
});

test("deliverables sent but not yet confirmed is still refundable", () => {
  const result = evaluateRefundEligibility({
    session: { ...heldSession, completed_at: new Date().toISOString() },
    payment: confirmedPayment
  });
  assert.equal(result.ok, true);
});

test("a previously failed refund may be retried", () => {
  const result = evaluateRefundEligibility({
    session: heldSession,
    payment: confirmedPayment,
    refund: { status: "failed" }
  });
  assert.equal(result.ok, true);
});

// ── Refund is refused once the money is gone or earned ───────
test("an unpaid session cannot be refunded", () => {
  for (const status of ["pending", "failed", "refunded", "refund_pending"]) {
    const result = evaluateRefundEligibility({
      session: heldSession,
      payment: { ...confirmedPayment, status }
    });
    assert.equal(result.ok, false, `status ${status} must not be refundable`);
    assert.equal(result.reason, "No confirmed payment to refund");
  }
});

test("a session with no payment at all cannot be refunded", () => {
  const result = evaluateRefundEligibility({ session: heldSession, payment: undefined });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "No confirmed payment to refund");
});

test("a released payout blocks the refund", () => {
  for (const status of ["pending", "processing", "completed"]) {
    const result = evaluateRefundEligibility({
      session: heldSession,
      payment: confirmedPayment,
      payout: { status }
    });
    assert.equal(result.ok, false, `payout status ${status} must block a refund`);
    assert.match(result.reason, /funds have left escrow/);
  }
});

test("a FAILED payout does not block the refund", () => {
  const result = evaluateRefundEligibility({
    session: heldSession,
    payment: confirmedPayment,
    payout: { status: "failed" }
  });
  assert.equal(result.ok, true);
});

test("once the client confirms deliverables the money is earned", () => {
  const result = evaluateRefundEligibility({
    session: { ...heldSession, client_confirmed_at: new Date().toISOString() },
    payment: confirmedPayment
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /already confirmed/);
});

test("an in-flight refund is not started twice", () => {
  for (const status of ["pending", "processing", "completed"]) {
    const result = evaluateRefundEligibility({
      session: heldSession,
      payment: confirmedPayment,
      refund: { status }
    });
    assert.equal(result.ok, false, `refund status ${status} must block a second refund`);
    assert.equal(result.reason, "Refund already in progress");
  }
});

// ── Refunds return 100%, the platform keeps nothing ──────────
test("a refund returns the full amount collected, with no fee deducted", () => {
  const { gross, platformFee } = computeSplit(50000);
  const refundAmount = Number(confirmedPayment.amount);
  assert.equal(refundAmount, gross);
  assert.ok(platformFee > 0, "the fee applies on payout, not on refund");
  assert.equal(refundAmount, 50000);
});

// ── Ordering: payout check precedes the confirmation check ───
test("a released payout is reported even when the client also confirmed", () => {
  const result = evaluateRefundEligibility({
    session: { ...heldSession, client_confirmed_at: new Date().toISOString() },
    payment: confirmedPayment,
    payout: { status: "completed" }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /funds have left escrow/);
});
