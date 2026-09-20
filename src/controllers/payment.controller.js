import { handleRequest } from "../utils/http.js";
import {
  getRefundStatus,
  handlePaystackWebhook,
  initiatePayment,
  refundSession,
  verifyPayment
} from "../services/payment.service.js";

const parsePositiveAmount = (raw) => {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * POST /api/payments/initiate
 * Body: { sessionId, amount? } — amount is validated against the
 * session's agreed amount server-side. Omit it and the agreed
 * amount is used automatically.
 */
export const initiatePaymentController = (req, res) => {
  return handleRequest(res, async () => {
    const sessionId = req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

    const result = await initiatePayment({
      clientId: req.user.id,
      sessionId,
      amount: parsePositiveAmount(req.body?.amount),
      callbackUrl: req.body?.callbackUrl || req.body?.callback_url
    });

    res.status(201).json(result);
  });
};

/**
 * GET /api/payments/verify/:reference
 * Redirect fallback — the webhook is the primary truth source.
 */
export const verifyPaymentController = (req, res) => {
  return handleRequest(res, async () => {
    const reference = req.params.reference
      || req.query.reference
      || req.query.trxref;

    if (!reference) return res.status(400).json({ message: "reference is required" });

    const result = await verifyPayment({ reference, userId: req.user.id });
    res.json(result);
  });
};

/**
 * POST /api/payments/webhook
 * Raw body + x-paystack-signature header. Handles:
 *   - charge.success      → mark payment confirmed
 *   - transfer.success    → mark payout completed
 *   - transfer.failed     → mark payout failed
 *   - transfer.reversed   → mark payout failed
 */
export const paystackWebhookController = (req, res) => {
  return handleRequest(res, async () => {
    let rawBody;
    let body;

    try {
      rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
      body = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;
    } catch {
      return res.status(400).json({ message: "Invalid webhook body" });
    }

    const signature = req.headers["x-paystack-signature"];
    const result = await handlePaystackWebhook({
      rawBody,
      signature,
      body
    });

    // Always 200 so Paystack doesn't retry unknown/unhandled events.
    res.json({ received: true, ...result });
  });
};

/**
 * POST /api/payments/refund
 * Body: { sessionId, reason? }
 * Full refund of an escrowed payment. Allowed for either party while the
 * money is still held — i.e. before the client confirms deliverables and
 * before any payout has been released.
 */
export const refundSessionController = (req, res) => {
  return handleRequest(res, async () => {
    const sessionId = req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

    const refund = await refundSession({
      userId: req.user.id,
      sessionId,
      reason: req.body?.reason
    });

    res.status(202).json({ message: "Refund initiated", refund });
  });
};

/**
 * GET /api/payments/refund/:sessionId
 * Refund status for a session (involved parties only).
 */
export const getRefundStatusController = (req, res) => {
  return handleRequest(res, async () => {
    const refund = await getRefundStatus({
      userId: req.user.id,
      sessionId: req.params.sessionId
    });
    res.json({ refund });
  });
};
