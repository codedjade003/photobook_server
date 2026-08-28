import crypto from "crypto";

// ─────────────────────────────────────────────────────────────
// Paystack configuration & low-level helpers.
// NEVER trust amounts from the frontend — always use
// session.agreed_amount (naira, NUMERIC) and convert to kobo
// only at the Paystack boundary.
// ─────────────────────────────────────────────────────────────

export const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";
export const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
export const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || "";
export const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || "";
export const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || "NGN";

export const PLATFORM_FEE_RATE = (() => {
  const parsed = Number.parseFloat(process.env.PLATFORM_FEE_RATE ?? "0.3");
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 1 ? parsed : 0.3;
})();

export const isPaystackConfigured = () => Boolean(PAYSTACK_SECRET_KEY);

// ─────────────────────────────────────────────────────────────
// Money math (naira ↔ kobo). Paystack takes integer kobo for NGN.
// ─────────────────────────────────────────────────────────────
export const nairaToKobo = (naira) => Math.round(Number(naira) * 100);
export const koboToNaira = (kobo) => Math.round(Number(kobo)) / 100;

export const computePlatformFee = (agreedAmountNaira) => {
  return Math.round(Number(agreedAmountNaira) * PLATFORM_FEE_RATE * 100) / 100;
};

export const computePayoutAmount = (agreedAmountNaira) => {
  return Math.round(Number(agreedAmountNaira) * (1 - PLATFORM_FEE_RATE) * 100) / 100;
};

// ─────────────────────────────────────────────────────────────
// Deterministic references → natural idempotency.
// Same session always produces the same payment/transfer
// reference, so retries never create duplicate Paystack records.
// ─────────────────────────────────────────────────────────────
const sessionShortId = (sessionId) => String(sessionId).replace(/-/g, "").slice(0, 16);

export const buildPaymentReference = (sessionId) => `pbb-p-${sessionShortId(sessionId)}`;
export const buildTransferReference = (sessionId) => `pbb-t-${sessionShortId(sessionId)}`;

// ─────────────────────────────────────────────────────────────
// Paystack REST wrapper. Throws Error with Paystack's message
// on non-2xx responses so controllers can surface clear errors.
// ─────────────────────────────────────────────────────────────
export const paystackFetch = async (path, { method = "GET", body, signal } = {}) => {
  if (!isPaystackConfigured()) {
    throw new Error("Paystack is not configured (PAYSTACK_SECRET_KEY missing)");
  }

  const headers = {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json"
  };

  let response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (err) {
    if (err?.name === "AbortError") throw new Error("Paystack request timed out");
    throw new Error(`Paystack network error: ${err.message}`);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response — fall through to status handling below
  }

  if (!response.ok || !payload?.status) {
    const message = payload?.message || `Paystack request failed (HTTP ${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.paystackResponse = payload;
    throw error;
  }

  return payload.data;
};

// ─────────────────────────────────────────────────────────────
// Webhook signature verification.
// Paystack signs the RAW request body with HMAC-SHA512 using
// PAYSTACK_WEBHOOK_SECRET and sends it as `x-paystack-signature`.
// ─────────────────────────────────────────────────────────────
export const verifyWebhookSignature = ({ rawBody, signature }) => {
  // Read dynamically so tests and runtime config changes are respected.
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Webhook secret not configured (PAYSTACK_WEBHOOK_SECRET missing)");
  }
  if (!signature || typeof signature !== "string") {
    return false;
  }
  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  const actual = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
};

// ─────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────
export const maskAccountNumber = (accountNumber) => {
  const str = String(accountNumber);
  if (str.length <= 4) return `****${str.slice(-2)}`;
  return `${"*".repeat(str.length - 4)}${str.slice(-4)}`;
};
