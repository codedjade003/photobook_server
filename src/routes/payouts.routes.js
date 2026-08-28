import { Router } from "express";
import auth from "../middleware/auth.js";
import { payoutAccountRateLimiter } from "../middleware/rateLimit.js";
import {
  deleteBankAccountController,
  getBankAccountController,
  getBanksController,
  getPayoutStatusController,
  saveBankAccountController,
  verifyBankAccountController
} from "../controllers/payout.controller.js";

const router = Router();

/**
 * @swagger
 * /api/payouts/banks:
 *   get:
 *     summary: List Nigerian banks available for payouts
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 banks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code: { type: string, example: "058" }
 *                       name: { type: string, example: "Guaranty Trust Bank" }
 *       502:
 *         description: Paystack request failed
 */
router.get("/banks", auth(), getBanksController);

/**
 * @swagger
 * /api/payouts/verify-account:
 *   post:
 *     summary: Resolve an account number to its owner name
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountNumber, bankCode]
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 example: "0123456789"
 *               bankCode:
 *                 type: string
 *                 example: "058"
 *     responses:
 *       200:
 *         description: Account resolved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accountName: { type: string, example: "JADE SMITH" }
 *                 accountNumber: { type: string }
 *                 bankCode: { type: string }
 *       400:
 *         description: Could not resolve account
 *       429:
 *         description: Too many verification attempts
 */
router.post("/verify-account", auth(), payoutAccountRateLimiter, verifyBankAccountController);

/**
 * @swagger
 * /api/payouts/bank-account:
 *   post:
 *     summary: Save payout bank account (creates Paystack recipient)
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Resolves the account name (if not provided), creates a Paystack
 *       transfer recipient, and stores the account number ENCRYPTED.
 *       Re-saving replaces the previous account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountNumber, bankCode]
 *             properties:
 *               accountNumber: { type: string, example: "0123456789" }
 *               bankCode: { type: string, example: "058" }
 *               accountName: { type: string, description: Optional — auto-resolved when omitted }
 *     responses:
 *       201:
 *         description: Bank account saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 account:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     bankCode: { type: string }
 *                     bankName: { type: string }
 *                     accountName: { type: string }
 *                     accountNumberMasked: { type: string, example: "********6789" }
 *                     isVerified: { type: boolean }
 *       400:
 *         description: Account resolution or recipient creation failed
 */
router.post("/bank-account", auth(), saveBankAccountController);

/**
 * @swagger
 * /api/payouts/bank-account:
 *   get:
 *     summary: Get saved payout bank account (masked)
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved account
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 account:
 *                   type: object
 *                   properties:
 *                     bankCode: { type: string }
 *                     bankName: { type: string }
 *                     accountName: { type: string }
 *                     accountNumberMasked: { type: string }
 *                     isVerified: { type: boolean }
 *       404:
 *         description: No bank account saved
 */
router.get("/bank-account", auth(), getBankAccountController);

/**
 * @swagger
 * /api/payouts/bank-account:
 *   delete:
 *     summary: Remove saved payout bank account
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     description: Also deletes the Paystack transfer recipient when possible.
 *     responses:
 *       200:
 *         description: Bank account removed
 *       404:
 *         description: No bank account saved
 */
router.delete("/bank-account", auth(), deleteBankAccountController);

/**
 * @swagger
 * /api/payouts/{sessionId}:
 *   get:
 *     summary: Payout status for a session (involved parties only)
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payout details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payout:
 *                   type: object
 *                   properties:
 *                     sessionId: { type: string, format: uuid }
 *                     creativeId: { type: string, format: uuid }
 *                     amount: { type: number, example: 35000 }
 *                     status: { type: string, enum: [pending, processing, completed, failed] }
 *                     transferCode: { type: string }
 *                     createdAt: { type: string }
 *       403:
 *         description: Not involved in this session
 *       404:
 *         description: Session or payout not found
 */
router.get("/:sessionId", auth(), getPayoutStatusController);

export default router;
