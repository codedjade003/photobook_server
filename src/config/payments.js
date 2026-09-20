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
  const parsed = Number.parseFloat(process.env.PLATFORM_FEE_RATE ?? "0.05");
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 1 ? parsed : 0.05;
})();

// How long deliverables sit unconfirmed before escrow releases automatically.
// Without this, a client who simply goes quiet strands the creative's money.
export const ESCROW_AUTO_RELEASE_DAYS = (() => {
  const parsed = Number.parseInt(process.env.ESCROW_AUTO_RELEASE_DAYS ?? "7", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
})();

// Outbound calls to Paystack are capped so a hung connection can't pin a
// request (and, during payout, a database transaction) open indefinitely.
export const PAYSTACK_TIMEOUT_MS = (() => {
  const parsed = Number.parseInt(process.env.PAYSTACK_TIMEOUT_MS ?? "20000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20000;
})();

export const isPaystackConfigured = () => Boolean(PAYSTACK_SECRET_KEY);

// ─────────────────────────────────────────────────────────────
// Money math (naira ↔ kobo). Paystack takes integer kobo for NGN.
// ─────────────────────────────────────────────────────────────
export const nairaToKobo = (naira) => Math.round(Number(naira) * 100);
export const koboToNaira = (kobo) => Math.round(Number(kobo)) / 100;

// The platform fee is rounded to the WHOLE naira and the creative receives
// the exact remainder, so fee + payout always reconciles to the amount
// collected — there is never a stray kobo left unaccounted for.
export const computePlatformFee = (agreedAmountNaira) => {
  const amount = Number(agreedAmountNaira);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const fee = Math.round(amount * PLATFORM_FEE_RATE);
  // Never charge more than was collected (matters only for tiny amounts).
  return Math.min(fee, Math.floor(amount));
};

export const computePayoutAmount = (agreedAmountNaira) => {
  const amount = Number(agreedAmountNaira);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round((amount - computePlatformFee(amount)) * 100) / 100;
};

// Single source of truth for a session's money breakdown.
export const computeSplit = (agreedAmountNaira) => {
  const gross = Math.round(Number(agreedAmountNaira) * 100) / 100;
  const platformFee = computePlatformFee(gross);
  return { gross, platformFee, payout: computePayoutAmount(gross) };
};

// ─────────────────────────────────────────────────────────────
// Deterministic references → natural idempotency.
// Same session always produces the same payment/transfer
// reference, so retries never create duplicate Paystack records.
// ─────────────────────────────────────────────────────────────
const sessionShortId = (sessionId) => String(sessionId).replace(/-/g, "").slice(0, 16);

export const buildPaymentReference = (sessionId) => `pbb-p-${sessionShortId(sessionId)}`;
export const buildTransferReference = (sessionId) => `pbb-t-${sessionShortId(sessionId)}`;
export const buildRefundReference = (sessionId) => `pbb-r-${sessionShortId(sessionId)}`;

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
      signal: signal ?? AbortSignal.timeout(PAYSTACK_TIMEOUT_MS)
    });
  } catch (err) {
    if (err?.name === "AbortError" || err?.name === "TimeoutError") {
      throw new Error("Paystack request timed out");
    }
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
// Paystack signs the RAW request body with HMAC-SHA512 using your
// Paystack SECRET KEY and sends it as `x-paystack-signature`.
// ─────────────────────────────────────────────────────────────
export const verifyWebhookSignature = ({ rawBody, signature }) => {
  // Paystack signs webhooks with your SECRET KEY — unlike Stripe it does not
  // issue a separate webhook signing secret. PAYSTACK_WEBHOOK_SECRET is kept
  // only as an explicit override (tests, or a future Paystack change); when it
  // is unset we correctly fall back to the secret key.
  // Read dynamically so tests and runtime config changes are respected.
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "Webhook secret not configured (set PAYSTACK_SECRET_KEY, or PAYSTACK_WEBHOOK_SECRET to override)"
    );
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
