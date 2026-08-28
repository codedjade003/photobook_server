import { Router, raw } from "express";
import auth from "../middleware/auth.js";
import { paymentRateLimiter } from "../middleware/rateLimit.js";
import {
  initiatePaymentController,
  paystackWebhookController,
  verifyPaymentController
} from "../controllers/payment.controller.js";

const router = Router();

/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initiate escrow payment for a session (client only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates (or reuses) a Paystack transaction for the session.
 *       The amount is ALWAYS taken from the session's agreed amount —
 *       the `amount` field in the body is validated against it and
 *       never trusted.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 example: "00000000-0000-0000-0000-000000000000"
 *               amount:
 *                 type: number
 *                 description: Optional. Must match session agreed amount.
 *                 example: 50000
 *     responses:
 *       201:
 *         description: Payment initialized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paystackAuthorizationUrl:
 *                   type: string
 *                   example: "https://checkout.paystack.com/xxx"
 *                 reference:
 *                   type: string
 *                   example: "pbb-p-0000000000000000"
 *       400:
 *         description: Session has no agreed amount or amount mismatch
 *       403:
 *         description: Not the session's client
 *       404:
 *         description: Session not found
 *       409:
 *         description: Payment already in progress
 *       502:
 *         description: Paystack initialization failed
 */
router.post("/initiate", auth(["client"]), paymentRateLimiter, initiatePaymentController);

/**
 * @swagger
 * /api/payments/verify/{reference}:
 *   get:
 *     summary: Verify a payment (redirect fallback — webhook is primary)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: confirmed }
 *                 sessionId: { type: string, format: uuid }
 *                 amountPaid: { type: number, example: 50000 }
 *                 reference: { type: string }
 *       404:
 *         description: Payment not found
 *       502:
 *         description: Paystack verification failed
 */
router.get("/verify/:reference", auth(), verifyPaymentController);

/**
 * @swagger
 * /api/payments/verify:
 *   get:
 *     summary: Verify a payment via query param (Paystack redirect target)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: reference
 *         schema: { type: string }
 *         description: Paystack appends ?reference=xxx on redirect
 *       - in: query
 *         name: trxref
 *         schema: { type: string }
 *         description: Legacy Paystack param, also accepted
 *     responses:
 *       200:
 *         description: Payment status
 */
router.get("/verify", auth(), verifyPaymentController);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Paystack webhook (charge.success, transfer events)
 *     tags: [Payments]
 *     description: |
 *       PRIMARY source of truth for payment confirmation.
 *       Paystack sends the raw body signed with HMAC-SHA512 in the
 *       `x-paystack-signature` header. Requests with an invalid
 *       signature are rejected with 401.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event: { type: string, example: charge.success }
 *               data: { type: object }
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Invalid body
 *       401:
 *         description: Invalid signature
 */
router.post("/webhook", raw({ type: "application/json" }), paystackWebhookController);

export default router;
