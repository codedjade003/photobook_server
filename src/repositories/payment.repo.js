import { query, getClient } from "../config/db.js";

// ─────────────────────────────────────────────────────────────
// Payments (inbound)
// ─────────────────────────────────────────────────────────────

export const findPaymentBySessionId = async ({ sessionId, client, forUpdate = false }) => {
  const executor = client || query;
  const { rows } = await executor(
    `SELECT *
     FROM payments
     WHERE session_id = $1
     ${forUpdate ? "FOR UPDATE" : ""}
     LIMIT 1`,
    [sessionId]
  );
  return rows[0];
};

export const findPaymentByReference = async (reference) => {
  const { rows } = await query(
    `SELECT * FROM payments WHERE reference = $1 LIMIT 1`,
    [reference]
  );
  return rows[0];
};

export const createPayment = async ({ sessionId, reference, amount, initiatedBy, client }) => {
  const executor = client || query;
  const { rows } = await executor(
    `INSERT INTO payments (session_id, reference, amount, status, initiated_by)
     VALUES ($1, $2, $3, 'pending', $4)
     RETURNING *`,
    [sessionId, reference, amount, initiatedBy]
  );
  return rows[0];
};

export const updatePaymentStatus = async ({ id, status, paystackResponse, client }) => {
  const executor = client || query;
  const { rows } = await executor(
    `UPDATE payments
     SET status = $2,
         paystack_response = COALESCE($3, paystack_response),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, paystackResponse ? JSON.stringify(paystackResponse) : null]
  );
  return rows[0];
};

// ─────────────────────────────────────────────────────────────
// Payouts (outbound)
// ─────────────────────────────────────────────────────────────

export const findPayoutBySessionId = async ({ sessionId, client }) => {
  const executor = client || query;
  const { rows } = await executor(
    `SELECT * FROM payouts WHERE session_id = $1 LIMIT 1`,
    [sessionId]
  );
  return rows[0];
};

export const findPayoutByTransferCode = async (transferCode) => {
  const { rows } = await query(
    `SELECT * FROM payouts WHERE transfer_code = $1 LIMIT 1`,
    [transferCode]
  );
  return rows[0];
};

export const createPayout = async ({
  sessionId,
  creativeId,
  amount,
  recipientCode,
  transferCode,
  status = "processing",
  paystackResponse,
  client
}) => {
  const executor = client || query;
  const { rows } = await executor(
    `INSERT INTO payouts (session_id, creative_id, amount, recipient_code, transfer_code, status, paystack_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      sessionId,
      creativeId,
      amount,
      recipientCode ?? null,
      transferCode ?? null,
      status,
      paystackResponse ? JSON.stringify(paystackResponse) : null
    ]
  );
  return rows[0];
};

export const updatePayoutStatus = async ({
  id,
  status,
  transferCode,
  paystackResponse,
  client
}) => {
  const executor = client || query;
  const { rows } = await executor(
    `UPDATE payouts
     SET status = $2,
         transfer_code = COALESCE($3, transfer_code),
         paystack_response = COALESCE($4, paystack_response),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      status,
      transferCode ?? null,
      paystackResponse ? JSON.stringify(paystackResponse) : null
    ]
  );
  return rows[0];
};

// ─────────────────────────────────────────────────────────────
// Creative bank accounts
// ─────────────────────────────────────────────────────────────

export const findBankAccountByUserId = async ({ userId, client, forUpdate = false }) => {
  const executor = client || query;
  const { rows } = await executor(
    `SELECT *
     FROM creative_bank_accounts
     WHERE user_id = $1
     ${forUpdate ? "FOR UPDATE" : ""}
     LIMIT 1`,
    [userId]
  );
  return rows[0];
};

export const saveBankAccount = async ({
  userId,
  bankCode,
  bankName,
  accountNumberEncrypted,
  accountName,
  recipientCode,
  client
}) => {
  const executor = client || query;
  const { rows } = await executor(
    `INSERT INTO creative_bank_accounts
       (user_id, bank_code, bank_name, account_number_encrypted, account_name, recipient_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       bank_code = EXCLUDED.bank_code,
       bank_name = EXCLUDED.bank_name,
       account_number_encrypted = EXCLUDED.account_number_encrypted,
       account_name = EXCLUDED.account_name,
       recipient_code = EXCLUDED.recipient_code,
       updated_at = NOW()
     RETURNING *`,
    [userId, bankCode, bankName ?? null, accountNumberEncrypted, accountName, recipientCode]
  );
  return rows[0];
};

export const deleteBankAccount = async ({ userId, client }) => {
  const executor = client || query;
  const { rows } = await executor(
    `DELETE FROM creative_bank_accounts
     WHERE user_id = $1
     RETURNING *`,
    [userId]
  );
  return rows[0];
};
