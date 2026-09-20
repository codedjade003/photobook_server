import { getClient } from "../config/db.js";
import {
  ESCROW_AUTO_RELEASE_DAYS,
  PLATFORM_FEE_RATE,
  buildPaymentReference,
  buildRefundReference,
  buildTransferReference,
  computeSplit,
  nairaToKobo,
  koboToNaira,
  paystackFetch,
  verifyWebhookSignature
} from "../config/payments.js";
import { encryptMessage, decryptMessage } from "../utils/messageCrypto.js";
import {
  createPayment,
  createPayout,
  createRefund,
  deleteBankAccount,
  findBankAccountByUserId,
  findPaymentByReference,
  findPaymentBySessionId,
  findPayoutByReference,
  findPayoutBySessionId,
  findPayoutByTransferCode,
  findRefundByPaystackId,
  findRefundBySessionId,
  saveBankAccount as saveBankAccountRepo,
  updatePaymentStatus,
  updatePayoutStatus,
  updateRefundStatus
} from "../repositories/payment.repo.js";
import {
  acceptSession,
  declineSession,
  findSessionById,
  findSessionsDueForAutoRelease,
  markSessionComplete,
  markSessionConfirmed,
  markSessionRefunded
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

export const initiatePayment = async ({ clientId, sessionId, amount, callbackUrl }) => {
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
      callback_url: callbackUrl || process.env.PAYSTACK_CALLBACK_URL || undefined,
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

export const verifyPayment = async ({ reference, userId }) => {
  const payment = await findPaymentByReference(reference);
  if (!payment) throw new Error("Payment not found");

  // References are guessable from a session id, so confirm the caller is
  // actually party to the session before disclosing amounts.
  if (userId) {
    const session = await findSessionById(payment.session_id);
    const involved = session
      && (userId === session.client_id || userId === session.photographer_id);
    if (!involved) throw new Error("forbidden");
  }

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

      // Confirm the amount Paystack actually collected matches what we
      // recorded. A short-paid charge must never unlock an escrow release.
      const paidNaira = koboToNaira(data.amount);
      if (Number.isFinite(paidNaira) && paidNaira + 0.01 < Number(payment.amount)) {
        logPaymentEvent("webhook_amount_mismatch", {
          reference: data.reference,
          expected: Number(payment.amount),
          paid: paidNaira
        });
        return { handled: false, reason: "amount_mismatch" };
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
      const matching = await resolvePayoutFromWebhook(data);
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
      const matching = await resolvePayoutFromWebhook(data);
      if (matching) {
        await updatePayoutStatus({ id: matching.id, status: "failed", paystackResponse: body });
        createNotification({
          userId: matching.creative_id,
          type: "payment_processed",
          title: "Payout Failed",
          body: "We couldn't transfer your payout. Please check your bank details and contact support.",
          data: { sessionId: matching.session_id }
        }).catch(() => {});
      }
      return { handled: Boolean(matching), event };
    }

    case "refund.processed": {
      const refund = await resolveRefundFromWebhook(data);
      if (!refund) return { handled: false, reason: "unknown_refund", event };
      if (refund.status === "completed") return { handled: false, reason: "already_completed" };

      await updateRefundStatus({
        id: refund.id,
        status: "completed",
        paystackRefundId: data.id ? String(data.id) : undefined,
        paystackResponse: body
      });
      await updatePaymentStatus({ id: refund.payment_id, status: "refunded" });
      await markSessionRefunded(refund.session_id);

      createNotification({
        userId: refund.client_id,
        type: "payment_processed",
        title: "Refund Completed",
        body: `Your refund of ₦${Number(refund.amount).toLocaleString()} has been returned to your account.`,
        data: { sessionId: refund.session_id }
      }).catch(() => {});

      sendPush(
        refund.client_id,
        "Refund Completed",
        `Your refund of ₦${Number(refund.amount).toLocaleString()} has been returned to your account.`,
        { type: "payment_processed", sessionId: refund.session_id }
      ).catch(() => {});

      logPaymentEvent("refund_completed", { sessionId: refund.session_id, amount: refund.amount });
      return { handled: true, event };
    }

    case "refund.failed": {
      const refund = await resolveRefundFromWebhook(data);
      if (!refund) return { handled: false, reason: "unknown_refund", event };
      await updateRefundStatus({ id: refund.id, status: "failed", paystackResponse: body });
      // Payment goes back to 'confirmed' so the refund can be retried.
      await updatePaymentStatus({ id: refund.payment_id, status: "confirmed" });
      logPaymentEvent("refund_failed", { sessionId: refund.session_id });
      return { handled: true, event };
    }

    case "refund.pending":
    case "refund.processing": {
      const refund = await resolveRefundFromWebhook(data);
      if (!refund) return { handled: false, reason: "unknown_refund", event };
      if (["completed", "failed"].includes(refund.status)) {
        return { handled: false, reason: "already_terminal" };
      }
      await updateRefundStatus({
        id: refund.id,
        status: "processing",
        paystackRefundId: data.id ? String(data.id) : undefined,
        paystackResponse: body
      });
      return { handled: true, event };
    }

    default:
      return { handled: false, reason: "unhandled_event", event };
  }
};

// Transfers are normally matched by transfer_code, but when the POST /transfer
// response never reached us (timeout) the payout row has no code yet. The
// deterministic reference we sent is the reliable fallback.
const resolvePayoutFromWebhook = async (data) => {
  if (data?.transfer_code) {
    const byCode = await findPayoutByTransferCode(data.transfer_code);
    if (byCode) return byCode;
  }
  if (data?.reference) {
    return findPayoutByReference(data.reference);
  }
  return undefined;
};

// Paystack refund webhooks identify the refund by its own id, and echo the
// original transaction reference — either is enough to find our row.
const resolveRefundFromWebhook = async (data) => {
  if (data?.id) {
    const byId = await findRefundByPaystackId(String(data.id));
    if (byId) return byId;
  }
  const transactionReference = data?.transaction_reference || data?.transaction?.reference;
  if (transactionReference) {
    const payment = await findPaymentByReference(transactionReference);
    if (payment) return findRefundBySessionId({ sessionId: payment.session_id });
  }
  return undefined;
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

// Non-throwing readiness check so the app can show "add a payout method"
// without treating a missing account as an error state.
export const getPayoutAccountStatus = async ({ userId }) => {
  const account = await findBankAccountByUserId({ userId });
  const feePercent = Math.round(PLATFORM_FEE_RATE * 10000) / 100;

  if (!account) {
    return {
      hasPayoutAccount: false,
      canReceivePayouts: false,
      platformFeePercent: feePercent,
      account: null
    };
  }

  return {
    hasPayoutAccount: true,
    canReceivePayouts: Boolean(account.recipient_code) && account.is_verified,
    platformFeePercent: feePercent,
    account: {
      id: account.id,
      bankCode: account.bank_code,
      bankName: account.bank_name,
      accountName: account.account_name,
      accountNumberMasked: maskStoredAccount(account.account_number_encrypted),
      isVerified: account.is_verified,
      updatedAt: account.updated_at
    }
  };
};

// What a creative would actually receive for a given amount — so the app can
// show the split up front instead of surprising them at payout time.
export const quotePayoutSplit = ({ amount }) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("amount must be a positive number");
  }
  const { gross, platformFee, payout } = computeSplit(value);
  return {
    grossAmount: gross,
    platformFee,
    payoutAmount: payout,
    platformFeePercent: Math.round(PLATFORM_FEE_RATE * 10000) / 100
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

  const updated = await markSessionComplete(sessionId, { autoReleaseDays: ESCROW_AUTO_RELEASE_DAYS });
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

  // If the client already paid, a decline means the requirements can never be
  // fulfilled — refund the full amount automatically rather than holding it.
  const refund = await refundSession({
    sessionId,
    reason: "The creative declined this booking",
    force: true
  }).catch((err) => {
    if (err.message !== "No confirmed payment to refund") {
      logPaymentEvent("decline_refund_failed", { sessionId, reason: err.message });
    }
    return null;
  });

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

  return { ...updated, refund };
};

// ─────────────────────────────────────────────────────────────
// Payout logic: the platform keeps PLATFORM_FEE_RATE (5% by default,
// rounded to the whole naira) and transfers the exact remainder to the
// creative's Paystack recipient.
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

    // A refunded (or refunding) session has no money left to release.
    const existingRefund = await findRefundBySessionId({ sessionId, client });
    if (existingRefund && existingRefund.status !== "failed") {
      throw new Error("Session has been refunded");
    }

    const creative = await findUserById(session.photographer_id);
    const bankAccount = await findBankAccountByUserId({ userId: session.photographer_id, client });
    if (!bankAccount?.recipient_code) {
      throw new Error("Creative hasn't set up payout account");
    }

    const { gross, platformFee, payout: payoutAmount } = computeSplit(session.agreed_amount);
    const reference = buildTransferReference(sessionId);

    const payout = existingPayout && existingPayout.status === "failed"
      ? await updatePayoutStatus({
          id: existingPayout.id,
          status: "processing",
          amount: payoutAmount,
          grossAmount: gross,
          platformFee,
          feeRate: PLATFORM_FEE_RATE,
          paystackResponse: null,
          client
        })
      : await createPayout({
          sessionId,
          creativeId: session.photographer_id,
          amount: payoutAmount,
          grossAmount: gross,
          platformFee,
          feeRate: PLATFORM_FEE_RATE,
          reference,
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
          reason: `Photobook payout for session ${sessionId} (₦${gross.toLocaleString()} less ₦${platformFee.toLocaleString()} platform fee)`
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
      grossAmount: gross,
      platformFee,
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
// Refunds — the client gets 100% back, we keep nothing.
//
// A refund is allowed while the escrow still holds the money: payment
// confirmed, deliverables not yet confirmed by the client, and no payout
// already released. Either party can trigger it (client changed their mind
// or wasn't satisfied; creative can't deliver), which is what makes the
// "full refund if requirements aren't fulfilled" promise real.
// ─────────────────────────────────────────────────────────────

// Pure predicate so the escrow rules can be tested without a database.
// Returns { ok } or { ok: false, reason } with the exact client-facing message.
export const evaluateRefundEligibility = ({ session, payment, payout, refund }) => {
  if (!payment || payment.status !== "confirmed") {
    return { ok: false, reason: "No confirmed payment to refund" };
  }
  if (payout && ["pending", "processing", "completed"].includes(payout.status)) {
    return { ok: false, reason: "Payout already in progress — the funds have left escrow" };
  }
  if (session?.client_confirmed_at) {
    return {
      ok: false,
      reason: "Deliverables already confirmed — this session can no longer be refunded"
    };
  }
  if (refund && refund.status !== "failed") {
    return { ok: false, reason: "Refund already in progress" };
  }
  return { ok: true };
};

export const refundSession = async ({ userId, sessionId, reason, force = false }) => {
  const client = await getClient();
  let refundRow;
  let session;
  let payment;

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM sessions WHERE id = $1 FOR UPDATE LIMIT 1`,
      [sessionId]
    );
    session = rows[0];
    if (!session) throw new Error("Session not found");

    // `force` is for internal callers (e.g. an auto-refund on decline) that
    // have already established authority; API callers must be a participant.
    if (!force) {
      const involved = userId === session.client_id || userId === session.photographer_id;
      if (!involved) throw new Error("forbidden");
    }

    payment = await findPaymentBySessionId({ sessionId, client, forUpdate: true });
    const payout = await findPayoutBySessionId({ sessionId, client });
    const existing = await findRefundBySessionId({ sessionId, client, forUpdate: true });

    const eligibility = evaluateRefundEligibility({ session, payment, payout, refund: existing });
    if (!eligibility.ok) throw new Error(eligibility.reason);

    const reference = buildRefundReference(sessionId);
    refundRow = existing
      ? await updateRefundStatus({ id: existing.id, status: "pending", client })
      : await createRefund({
          sessionId,
          paymentId: payment.id,
          clientId: session.client_id,
          amount: Number(payment.amount),
          reference,
          reason: reason || "Session requirements were not fulfilled",
          initiatedBy: force ? null : userId,
          client
        });

    // Lock the payment out of any competing payout while the refund is live.
    await updatePaymentStatus({ id: payment.id, status: "refund_pending", client });

    await client.query("COMMIT");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* already finished */ }
    client.release();
    throw err;
  }

  client.release();

  // Call Paystack outside the transaction. Omitting `amount` refunds in full.
  let paystackData;
  try {
    paystackData = await paystackFetch("/refund", {
      method: "POST",
      body: {
        transaction: payment.reference,
        merchant_note: reason || `Photobook escrow refund for session ${sessionId}`,
        customer_note: "Your Photobook booking was refunded in full."
      }
    });
  } catch (err) {
    await updateRefundStatus({
      id: refundRow.id,
      status: "failed",
      paystackResponse: err.paystackResponse || { message: err.message }
    });
    // Put the payment back so the refund can be retried.
    await updatePaymentStatus({ id: payment.id, status: "confirmed" });
    logPaymentEvent("refund_failed", { sessionId, reason: err.message });
    throw new Error(`Refund failed: ${err.message}`);
  }

  const updated = await updateRefundStatus({
    id: refundRow.id,
    status: "processing",
    paystackRefundId: paystackData?.id ? String(paystackData.id) : undefined,
    paystackResponse: paystackData
  });

  logPaymentEvent("refund_initiated", {
    sessionId,
    amount: Number(payment.amount),
    initiatedBy: force ? "system" : userId
  });

  const amountLabel = `₦${Number(payment.amount).toLocaleString()}`;
  createNotification({
    userId: session.client_id,
    type: "payment_processed",
    title: "Refund On Its Way",
    body: `Your full refund of ${amountLabel} is being processed. It usually lands within 3–5 business days.`,
    data: { sessionId }
  }).catch(() => {});

  sendPush(
    session.client_id,
    "Refund On Its Way",
    `Your full refund of ${amountLabel} is being processed.`,
    { type: "payment_processed", sessionId }
  ).catch(() => {});

  createNotification({
    userId: session.photographer_id,
    type: "payment_processed",
    title: "Session Refunded",
    body: `The escrowed ${amountLabel} for this session has been refunded to the client.`,
    data: { sessionId }
  }).catch(() => {});

  return formatRefund(updated);
};

export const getRefundStatus = async ({ userId, sessionId }) => {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  const involved = userId === session.client_id || userId === session.photographer_id;
  if (!involved) throw new Error("forbidden");

  const refund = await findRefundBySessionId({ sessionId });
  if (!refund) throw new Error("Refund not found");
  return formatRefund(refund);
};

const formatRefund = (refund) => ({
  id: refund.id,
  sessionId: refund.session_id,
  amount: Number(refund.amount),
  status: refund.status,
  reason: refund.reason,
  reference: refund.reference,
  createdAt: refund.created_at,
  updatedAt: refund.updated_at
});

// ─────────────────────────────────────────────────────────────
// Escrow sweep: release payouts whose auto-release deadline passed.
// Runs from the background job in escrow.job.js.
// ─────────────────────────────────────────────────────────────

export const releaseExpiredEscrows = async ({ limit = 50 } = {}) => {
  const due = await findSessionsDueForAutoRelease(limit);
  const results = [];

  for (const { id: sessionId } of due) {
    try {
      const session = await findSessionById(sessionId);
      if (!session) continue;

      // Confirming is irreversible — it ends the client's refund window — so
      // never do it unless the transfer can actually go out. A creative with
      // no payout account gets nudged and the session is retried next sweep.
      const bankAccount = await findBankAccountByUserId({ userId: session.photographer_id });
      if (!bankAccount?.recipient_code) {
        createNotification({
          userId: session.photographer_id,
          type: "payment_processed",
          title: "Add Your Payout Account",
          body: "Your payment is ready but we have no bank account to send it to. Add one to get paid.",
          data: { sessionId }
        }).catch(() => {});
        results.push({ sessionId, released: false, reason: "Creative hasn't set up payout account" });
        continue;
      }

      // Auto-release treats silence as acceptance, so record the confirmation
      // before releasing — otherwise triggerPayoutIfReady refuses.
      await markSessionConfirmed(sessionId);
      const payout = await triggerPayoutIfReady({ sessionId });
      logPaymentEvent("escrow_auto_released", { sessionId, amount: payout.amount });
      results.push({ sessionId, released: true });
    } catch (err) {
      logPaymentEvent("escrow_auto_release_failed", { sessionId, reason: err.message });
      results.push({ sessionId, released: false, reason: err.message });
    }
  }

  return results;
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
  grossAmount: payout.gross_amount === null || payout.gross_amount === undefined
    ? null
    : Number(payout.gross_amount),
  platformFee: Number(payout.platform_fee ?? 0),
  status: payout.status,
  transferCode: payout.transfer_code,
  createdAt: payout.created_at,
  updatedAt: payout.updated_at
});
