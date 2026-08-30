import { getClient } from "../config/db.js";
import {
  buildPaymentReference,
  buildTransferReference,
  computePayoutAmount,
  nairaToKobo,
  koboToNaira,
  paystackFetch,
  verifyWebhookSignature
} from "../config/payments.js";
import { encryptMessage, decryptMessage } from "../utils/messageCrypto.js";
import {
  createPayment,
  createPayout,
  deleteBankAccount,
  findBankAccountByUserId,
  findPaymentByReference,
  findPaymentBySessionId,
  findPayoutBySessionId,
  findPayoutByTransferCode,
  saveBankAccount as saveBankAccountRepo,
  updatePaymentStatus,
  updatePayoutStatus
} from "../repositories/payment.repo.js";
import {
  acceptSession,
  declineSession,
  findSessionById,
  markSessionComplete,
  markSessionConfirmed
} from "../repositories/session.repo.js";
import { findUserById } from "../repositories/user.repo.js";
import { createNotification } from "./notification.service.js";
import { sendPush } from "./push.service.js";

const logPaymentEvent = (event, detail) => {
  console.log(`[payments] ${event}`, JSON.stringify(detail));
};

// ─────────────────────────────────────────────────────────────
// Payment initiation (client pays FULL amount → platform)
// ─────────────────────────────────────────────────────────────

export const initiatePayment = async ({ clientId, sessionId, amount }) => {
  const client = await getClient();
  let session;
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM sessions WHERE id = $1 FOR UPDATE LIMIT 1`,
      [sessionId]
    );
    session = rows[0];

    if (!session) throw new Error("Session not found");
    if (session.client_id !== clientId) throw new Error("forbidden");

    if (!session.agreed_amount) {
      throw new Error("Session has no agreed amount");
    }

    // Never trust the frontend amount when the session has one.
    if (amount !== undefined && Number(amount) !== Number(session.agreed_amount)) {
      throw new Error("Amount does not match the session agreed amount");
    }

    const reference = buildPaymentReference(sessionId);

    // Create/reuse the payment row INSIDE the transaction so concurrent
    // initiation attempts for the same session can't race.
    const existing = await findPaymentBySessionId({ sessionId, client, forUpdate: true });
    if (existing && ["pending", "confirmed"].includes(existing.status)) {
      throw new Error("Payment already in progress");
    }
    if (existing && existing.status === "failed") {
      // Reuse the same row + reference for idempotent retry.
      await updatePaymentStatus({ id: existing.id, status: "pending", client });
    } else if (!existing) {
      await createPayment({
        sessionId,
        reference,
        amount: session.agreed_amount,
        initiatedBy: clientId,
        client
      });
    }

    const clientUser = await findUserById(clientId);
    await client.query("COMMIT");

    // Call Paystack OUTSIDE the transaction to keep locks short.
    const paystackPayload = {
      email: clientUser?.email || `${clientId}@photobookhq.com`,
      amount: nairaToKobo(session.agreed_amount),
      currency: "NGN",
      reference,
      callback_url: process.env.PAYSTACK_CALLBACK_URL || undefined,
      metadata: {
        sessionId,
        clientId,
        type: "photobook_escrow"
      }
    };

    let paystackData;
    try {
      paystackData = await paystackFetch("/transaction/initialize", {
        method: "POST",
        body: paystackPayload
      });
    } catch (err) {
      // Mark the pending row failed so the user can retry later.
      const paymentRow = await findPaymentBySessionId({ sessionId });
      if (paymentRow && paymentRow.status === "pending") {
        await updatePaymentStatus({
          id: paymentRow.id,
          status: "failed",
          paystackResponse: err.paystackResponse || { message: err.message }
        });
      }
      throw new Error(`Paystack could not initialize payment: ${err.message}`);
    }

    logPaymentEvent("payment_initiated", { sessionId, reference, amount: session.agreed_amount });

    return {
      paystackAuthorizationUrl: paystackData.authorization_url,
      reference
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* already finished */ }
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// Payment verification (redirect fallback — webhook is primary)
// ─────────────────────────────────────────────────────────────

export const verifyPayment = async ({ reference }) => {
  const payment = await findPaymentByReference(reference);
  if (!payment) throw new Error("Payment not found");

  if (payment.status === "confirmed") {
    return {
      status: "confirmed",
      sessionId: payment.session_id,
      amountPaid: Number(payment.amount),
      reference: payment.reference
    };
  }

  const paystackData = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);

  if (paystackData.status === "success") {
    const updated = await updatePaymentStatus({
      id: payment.id,
      status: "confirmed",
      paystackResponse: paystackData
    });
    logPaymentEvent("payment_confirmed", { reference, amount: payment.amount });

    createNotification({
      userId: updated.initiated_by,
      type: "payment_processed",
      title: "Payment Confirmed",
      body: `Your payment of ₦${Number(payment.amount).toLocaleString()} has been confirmed.`,
      data: { sessionId: payment.session_id, reference }
    }).catch(() => {});

    sendPush(
      updated.initiated_by,
      "Payment Confirmed",
      `Your payment of ₦${Number(payment.amount).toLocaleString()} has been confirmed.`,
      { type: "payment_processed", sessionId: payment.session_id }
    ).catch(() => {});

    return {
      status: "confirmed",
      sessionId: payment.session_id,
      amountPaid: Number(payment.amount),
      reference: payment.reference
    };
  }

  // Failed/abandoned
  await updatePaymentStatus({
    id: payment.id,
    status: "failed",
    paystackResponse: paystackData
  });
  throw new Error("Payment was not successful");
};

// ─────────────────────────────────────────────────────────────
// Webhook (PRIMARY truth source)
// ─────────────────────────────────────────────────────────────

export const handlePaystackWebhook = async ({ rawBody, signature, body }) => {
  if (!verifyWebhookSignature({ rawBody, signature })) {
    throw new Error("Invalid webhook signature");
  }

  const event = body?.event;
  const data = body?.data || {};
  logPaymentEvent("webhook_received", { event, reference: data.reference });

  switch (event) {
    case "charge.success": {
      const payment = await findPaymentByReference(data.reference);
      if (!payment) {
        logPaymentEvent("webhook_unknown_reference", { reference: data.reference });
        return { handled: false, reason: "unknown_reference" };
      }
      if (payment.status === "confirmed") {
        return { handled: false, reason: "already_confirmed" };
      }
      await updatePaymentStatus({ id: payment.id, status: "confirmed", paystackResponse: body });

      const session = await findSessionById(payment.session_id);
      if (session) {
        await Promise.all([
          createNotification({
            userId: payment.initiated_by,
            type: "payment_processed",
            title: "Payment Confirmed",
            body: `Your payment of ₦${Number(payment.amount).toLocaleString()} has been confirmed.`,
            data: { sessionId: session.id, reference: payment.reference }
          }).catch(() => {}),
          createNotification({
            userId: session.photographer_id,
            type: "payment_processed",
            title: "Payment Received",
            body: "A client has paid for a session. Funds are now held in escrow.",
            data: { sessionId: session.id, reference: payment.reference }
          }).catch(() => {}),
          sendPush(
            payment.initiated_by,
            "Payment Confirmed",
            `Your payment of ₦${Number(payment.amount).toLocaleString()} has been confirmed.`,
            { type: "payment_processed", sessionId: session.id }
          ).catch(() => {})
        ]);
      }
      return { handled: true, event };
    }

    case "transfer.success": {
      const transferCode = data.transfer_code;
      const matching = await findPayoutByTransferCode(transferCode);
      if (matching) {
        await updatePayoutStatus({
          id: matching.id,
          status: "completed",
          paystackResponse: body
        });
        createNotification({
          userId: matching.creative_id,
          type: "payment_processed",
          title: "Payout Completed",
          body: `Your payout of ₦${Number(matching.amount).toLocaleString()} has been transferred to your bank account.`,
          data: { sessionId: matching.session_id, transferCode }
        }).catch(() => {});
      }
      return { handled: Boolean(matching), event };
    }

    case "transfer.failed":
    case "transfer.reversed": {
      const transferCode = data.transfer_code;
      const matching = await findPayoutByTransferCode(transferCode);
      if (matching) {
        await updatePayoutStatus({ id: matching.id, status: "failed", paystackResponse: body });
      }
      return { handled: Boolean(matching), event };
    }

    default:
      return { handled: false, reason: "unhandled_event", event };
  }
};

// ─────────────────────────────────────────────────────────────
// Bank account management (creative payout destination)
// ─────────────────────────────────────────────────────────────

export const getBanks = async () => {
  const banks = await paystackFetch("/bank?currency=NGN&perPage=100");
  return banks.map((b) => ({ code: b.code, name: b.name }));
};

export const verifyBankAccount = async ({ accountNumber, bankCode }) => {
  const data = await paystackFetch(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  );
  if (!data?.account_name) {
    throw new Error("Bank account verification failed");
  }
  return { accountName: data.account_name, accountNumber, bankCode };
};

export const saveBankAccount = async ({ userId, accountNumber, bankCode, accountName }) => {
  const existing = await findBankAccountByUserId({ userId });

  let resolvedName = accountName;
  if (!resolvedName) {
    const resolved = await verifyBankAccount({ accountNumber, bankCode });
    resolvedName = resolved.accountName;
  }

  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  // Create Paystack transfer recipient.
  const recipient = await paystackFetch("/transferrecipient", {
    method: "POST",
    body: {
      type: "nuban",
      name: resolvedName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN"
    }
  });

  if (!recipient?.recipient_code) {
    throw new Error("Paystack could not create transfer recipient");
  }

  const encrypted = encryptMessage(String(accountNumber));
  const saved = await saveBankAccountRepo({
    userId,
    bankCode,
    bankName: recipient.details?.bank_name || null,
    accountNumberEncrypted: encrypted,
    accountName: resolvedName,
    recipientCode: recipient.recipient_code
  });

  logPaymentEvent("bank_account_saved", { userId, recipientCode: recipient.recipient_code });
  void existing;
  return {
    id: saved.id,
    bankCode: saved.bank_code,
    bankName: saved.bank_name,
    accountName: saved.account_name,
    accountNumberMasked: maskStoredAccount(saved.account_number_encrypted),
    isVerified: saved.is_verified
  };
};

export const getBankAccount = async ({ userId }) => {
  const account = await findBankAccountByUserId({ userId });
  if (!account) throw new Error("No bank account saved");
  return {
    id: account.id,
    bankCode: account.bank_code,
    bankName: account.bank_name,
    accountName: account.account_name,
    accountNumberMasked: maskStoredAccount(account.account_number_encrypted),
    isVerified: account.is_verified,
    createdAt: account.created_at
  };
};

export const removeBankAccount = async ({ userId }) => {
  const account = await findBankAccountByUserId({ userId });
  if (!account) throw new Error("No bank account saved");

  // Best-effort cleanup of the Paystack recipient.
  if (account.recipient_code) {
    try {
      await paystackFetch(`/transferrecipient/${encodeURIComponent(account.recipient_code)}`, {
        method: "DELETE"
      });
    } catch (err) {
      console.error("Could not delete Paystack recipient:", err.message);
    }
  }

  await deleteBankAccount({ userId });
  logPaymentEvent("bank_account_deleted", { userId });
  return { deleted: true };
};

const maskStoredAccount = (encrypted) => {
  try {
    const plain = decryptMessage(encrypted);
    const str = String(plain);
    return str.length <= 4 ? `****${str.slice(-2)}` : `${"*".repeat(str.length - 4)}${str.slice(-4)}`;
  } catch {
    return "********";
  }
};

// ─────────────────────────────────────────────────────────────
// Session completion + confirmation → payout release
// ─────────────────────────────────────────────────────────────

export const completeSession = async ({ userId, sessionId }) => {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.photographer_id !== userId) throw new Error("forbidden");
  if (session.completed_at) throw new Error("Deliverables already marked as sent");

  const updated = await markSessionComplete(sessionId);
  logPaymentEvent("deliverables_sent", { sessionId, by: userId });

  // Attempt payout (no-op unless the client has also confirmed).
  const payout = await triggerPayoutIfReady({ sessionId }).catch((err) => {
    logPaymentEvent("payout_not_triggered", { sessionId, reason: err.message });
    return null;
  });

  return { session: updated, payout };
};

export const confirmSession = async ({ userId, sessionId }) => {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.client_id !== userId) throw new Error("forbidden");
  if (session.client_confirmed_at) throw new Error("Deliverables already confirmed");

  const updated = await markSessionConfirmed(sessionId);
  logPaymentEvent("deliverables_confirmed", { sessionId, by: userId });

  const payout = await triggerPayoutIfReady({ sessionId }).catch((err) => {
    logPaymentEvent("payout_not_triggered", { sessionId, reason: err.message });
    return null;
  });

  return { session: updated, payout };
};

// ─────────────────────────────────────────────────────────────
// Booking acceptance / decline (creative)
// ─────────────────────────────────────────────────────────────

export const acceptBooking = async ({ userId, sessionId }) => {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.photographer_id !== userId) throw new Error("forbidden");
  if (session.status !== "pending") throw new Error("Booking is not pending acceptance");

  const updated = await acceptSession(sessionId);
  logPaymentEvent("booking_accepted", { sessionId, by: userId });

  // Notify the client (in-app + push).
  createNotification({
    userId: session.client_id,
    type: "booking_confirmed",
    title: "Booking Accepted",
    body: "The creative accepted your booking.",
    data: { sessionId }
  }).catch(() => {});

  sendPush(
    session.client_id,
    "Booking Accepted",
    "The creative accepted your booking.",
    { type: "booking_confirmed", sessionId }
  ).catch(() => {});

  return updated;
};

export const declineBooking = async ({ userId, sessionId }) => {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.photographer_id !== userId) throw new Error("forbidden");
  if (session.status !== "pending") throw new Error("Booking is not pending acceptance");

  const updated = await declineSession(sessionId);
  logPaymentEvent("booking_declined", { sessionId, by: userId });

  createNotification({
    userId: session.client_id,
    type: "booking_declined",
    title: "Booking Declined",
    body: "The creative declined your booking.",
    data: { sessionId }
  }).catch(() => {});

  sendPush(
    session.client_id,
    "Booking Declined",
    "The creative declined your booking.",
    { type: "booking_declined", sessionId }
  ).catch(() => {});

  return updated;
};

// ─────────────────────────────────────────────────────────────
// Payout logic: 70% to creative, 30% platform fee.
// ─────────────────────────────────────────────────────────────

export const triggerPayoutIfReady = async ({ sessionId }) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM sessions WHERE id = $1 FOR UPDATE LIMIT 1`,
      [sessionId]
    );
    const session = rows[0];
    if (!session) throw new Error("Session not found");

    // Both parties must complete/confirm before release.
    if (!session.completed_at || !session.client_confirmed_at) {
      throw new Error("Both complete and confirm are required before payout");
    }

    const payment = await findPaymentBySessionId({ sessionId, client, forUpdate: true });
    if (!payment || payment.status !== "confirmed") {
      throw new Error("Payment must be confirmed before payout");
    }

    const existingPayout = await findPayoutBySessionId({ sessionId, client });
    if (existingPayout && ["pending", "processing", "completed"].includes(existingPayout.status)) {
      throw new Error("Payout already in progress");
    }

    const creative = await findUserById(session.photographer_id);
    const bankAccount = await findBankAccountByUserId({ userId: session.photographer_id, client });
    if (!bankAccount?.recipient_code) {
      throw new Error("Creative hasn't set up payout account");
    }

    const payoutAmount = computePayoutAmount(session.agreed_amount);
    const reference = buildTransferReference(sessionId);

    const payout = existingPayout && existingPayout.status === "failed"
      ? await updatePayoutStatus({
          id: existingPayout.id,
          status: "processing",
          paystackResponse: null,
          client
        })
      : await createPayout({
          sessionId,
          creativeId: session.photographer_id,
          amount: payoutAmount,
          recipientCode: bankAccount.recipient_code,
          status: "processing",
          client
        });

    await client.query("COMMIT");

    // Call Paystack outside the transaction.
    let paystackData;
    try {
      paystackData = await paystackFetch("/transfer", {
        method: "POST",
        body: {
          source: "balance",
          amount: nairaToKobo(payoutAmount),
          recipient: bankAccount.recipient_code,
          reference,
          reason: `Photobook payout for session ${sessionId} (70% of ₦${Number(session.agreed_amount).toLocaleString()})`
        }
      });
    } catch (err) {
      await updatePayoutStatus({
        id: payout.id,
        status: "failed",
        paystackResponse: err.paystackResponse || { message: err.message }
      });
      logPaymentEvent("payout_failed", { sessionId, reason: err.message });
      throw new Error(`Transfer failed: ${err.message}`);
    }

    const transferCode = paystackData.transfer_code || paystackData.reference;
    const refreshed = await updatePayoutStatus({
      id: payout.id,
      status: "processing",
      transferCode,
      paystackResponse: paystackData
    });

    logPaymentEvent("payout_initiated", {
      sessionId,
      transferCode,
      amount: payoutAmount,
      recipient: creative?.id
    });

    createNotification({
      userId: session.photographer_id,
      type: "payment_processed",
      title: "Payout Initiated",
      body: `Your payout of ₦${payoutAmount.toLocaleString()} is being processed.`,
      data: { sessionId, transferCode }
    }).catch(() => {});

    return {
      status: refreshed.status,
      amount: Number(refreshed.amount),
      transferCode: refreshed.transfer_code,
      createdAt: refreshed.created_at
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* already finished */ }
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// Payout status
// ─────────────────────────────────────────────────────────────

export const getPayoutStatus = async ({ userId, sessionId }) => {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  const involved = userId === session.client_id || userId === session.photographer_id;
  if (!involved) throw new Error("forbidden");

  const payout = await findPayoutBySessionId({ sessionId });
  if (!payout) throw new Error("Payout not found");

  // Refresh from Paystack when we have a transfer code and the payout
  // is not yet terminal.
  if (payout.transfer_code && ["pending", "processing"].includes(payout.status)) {
    try {
      const transfer = await paystackFetch(`/transfer/${encodeURIComponent(payout.transfer_code)}`);
      const statusMap = {
        success: "completed",
        paid: "completed",
        failed: "failed",
        reversed: "failed",
        pending: "processing",
        "otp required": "processing"
      };
      const nextStatus = statusMap[transfer.status] || payout.status;
      if (nextStatus !== payout.status) {
        const updated = await updatePayoutStatus({
          id: payout.id,
          status: nextStatus,
          paystackResponse: transfer
        });
        return formatPayout(updated);
      }
    } catch (err) {
      console.error("Payout status refresh failed:", err.message);
    }
  }

  return formatPayout(payout);
};

const formatPayout = (payout) => ({
  id: payout.id,
  sessionId: payout.session_id,
  creativeId: payout.creative_id,
  amount: Number(payout.amount),
  status: payout.status,
  transferCode: payout.transfer_code,
  createdAt: payout.created_at,
  updatedAt: payout.updated_at
});
