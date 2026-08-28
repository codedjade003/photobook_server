import { handleRequest } from "../utils/http.js";
import {
  getBanks,
  getBankAccount,
  getPayoutStatus,
  removeBankAccount,
  saveBankAccount,
  verifyBankAccount
} from "../services/payment.service.js";

const requireFields = (res, body, fields) => {
  for (const field of fields) {
    if (!body?.[field] || typeof body[field] !== "string" || !body[field].trim()) {
      res.status(400).json({ message: `${field} is required` });
      return false;
    }
  }
  return true;
};

/**
 * GET /api/payouts/banks
 * Nigerian banks list (cached by Paystack).
 */
export const getBanksController = (req, res) => {
  return handleRequest(res, async () => {
    const banks = await getBanks();
    res.json({ banks });
  });
};

/**
 * POST /api/payouts/verify-account
 * Body: { accountNumber, bankCode } → { accountName }
 */
export const verifyBankAccountController = (req, res) => {
  return handleRequest(res, async () => {
    if (!requireFields(res, req.body, ["accountNumber", "bankCode"])) return;
    const result = await verifyBankAccount({
      accountNumber: req.body.accountNumber,
      bankCode: req.body.bankCode
    });
    res.json(result);
  });
};

/**
 * POST /api/payouts/bank-account
 * Body: { accountNumber, bankCode, accountName? }
 * Resolves the account name, creates a Paystack transfer recipient,
 * encrypts the account number at rest.
 */
export const saveBankAccountController = (req, res) => {
  return handleRequest(res, async () => {
    if (!requireFields(res, req.body, ["accountNumber", "bankCode"])) return;
    const account = await saveBankAccount({
      userId: req.user.id,
      accountNumber: req.body.accountNumber,
      bankCode: req.body.bankCode,
      accountName: req.body.accountName
    });
    res.status(201).json({ message: "Bank account saved", account });
  });
};

/**
 * GET /api/payouts/bank-account
 * Saved account with masked number.
 */
export const getBankAccountController = (req, res) => {
  return handleRequest(res, async () => {
    const account = await getBankAccount({ userId: req.user.id });
    res.json({ account });
  });
};

/**
 * DELETE /api/payouts/bank-account
 * Removes the saved account (and the Paystack recipient).
 */
export const deleteBankAccountController = (req, res) => {
  return handleRequest(res, async () => {
    const result = await removeBankAccount({ userId: req.user.id });
    res.json(result);
  });
};

/**
 * GET /api/payouts/:sessionId
 * Payout status for a session (involved parties only).
 */
export const getPayoutStatusController = (req, res) => {
  return handleRequest(res, async () => {
    const result = await getPayoutStatus({
      userId: req.user.id,
      sessionId: req.params.sessionId
    });
    res.json({ payout: result });
  });
};
