# Photobook Escrow Payments — Implementation Guide

> Paystack-powered escrow. Client pays the FULL amount → funds are held in the
> platform Paystack balance → on completion **70%** is transferred to the
> creative and **30%** is retained as the platform fee.

---

## 1. Flow Overview

```mermaid
sequenceDiagram
    participant C as Client (app)
    participant BE as Backend
    participant PS as Paystack
    participant CR as Creative (app)

    C->>BE: POST /api/payments/initiate { sessionId }
    BE->>PS: transaction/initialize (amount = session.agreedAmount)
    PS-->>BE: authorization_url + reference
    BE-->>C: { paystackAuthorizationUrl, reference }
    C->>PS: Open webview at authorization_url
    PS->>BE: POST /api/payments/webhook (charge.success) ★ PRIMARY TRUTH
    BE-->>CR: notification "Payment Received"
    Note over C,CR: ... session happens ...
    CR->>BE: PATCH /api/sessions/:id/complete
    C->>BE: PATCH /api/sessions/:id/confirm
    BE->>PS: POST /transfer (70% to creative recipient)
    PS->>BE: POST /api/payments/webhook (transfer.success)
    BE-->>CR: notification "Payout Completed"
```

**Both** `complete` (creative) **and** `confirm` (client) are required before
any payout is released. Payout never happens for unpaid sessions.

---

## 2. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYSTACK_SECRET_KEY` | ✅ | Server-side key. Use `sk_test_...` in dev, `sk_live_...` in prod. Never expose to the frontend. |
| `PAYSTACK_PUBLIC_KEY` | ✅ (frontend) | `pk_test_...` / `pk_live_...` — frontend initializes the Paystack widget/webview with this. |
| `PAYSTACK_CALLBACK_URL` | ✅ | `https://api.photobookhq.com/api/payments/verify` — Paystack redirects here with `?reference=xxx`. |
| `PAYSTACK_WEBHOOK_SECRET` | ✅ | Set in Paystack dashboard → Settings → API Keys & Webhooks. HMAC-SHA512 signing. |
| `PAYSTACK_BASE_URL` | optional | Defaults to `https://api.paystack.co`. |
| `PAYSTACK_CURRENCY` | optional | Defaults to `NGN`. |
| `PLATFORM_FEE_RATE` | optional | Defaults to `0.3` (30%). Payout = amount × (1 − rate). |

> ⚠️ Webhook requests with an invalid signature are **rejected with 401**.
> Requests with a valid signature always get **200** (unknown events are
> ignored so Paystack doesn't retry them).

---

## 3. Endpoints

### 3.1 Initiate payment

```
POST /api/payments/initiate        (auth: client)
Body: { "sessionId": "<uuid>", "amount": 50000 }   // amount OPTIONAL
```

- The amount is **never trusted** — it must match `session.agreedAmount`
  (or be omitted entirely). Mismatch → `400`.
- Idempotent: the reference is deterministic per session
  (`pbb-p-<16 hex>`). Retrying after a failed attempt reuses the same
  reference — no duplicate Paystack transactions.
- `409 Payment already in progress` when a payment is `pending` or
  `confirmed` for that session.
- `400 Session has no agreed amount` when `agreed_amount` is NULL.

**Response**
```json
{
  "paystackAuthorizationUrl": "https://checkout.paystack.com/...",
  "reference": "pbb-p-0000000000000000"
}
```

### 3.2 Verify payment (redirect fallback)

```
GET /api/payments/verify/:reference   (auth)
GET /api/payments/verify?reference=   (auth)  ← Paystack redirect target
```

**Response**
```json
{ "status": "confirmed", "sessionId": "<uuid>", "amountPaid": 50000, "reference": "pbb-p-..." }
```

### 3.3 Webhook (PRIMARY truth source)

```
POST /api/payments/webhook            (no auth — HMAC signature)
```

Events handled:

| Event | Effect |
|-------|--------|
| `charge.success` | Payment → `confirmed`, notifications to client + creative |
| `transfer.success` | Payout → `completed`, notification to creative |
| `transfer.failed` / `transfer.reversed` | Payout → `failed` |

### 3.4 Bank accounts (creative payout destination)

```
GET    /api/payouts/banks                    → [{ code, name }] Nigerian banks
POST   /api/payouts/verify-account           → { accountName, accountNumber, bankCode }
POST   /api/payouts/bank-account             → save (creates Paystack recipient, encrypts number)
GET    /api/payouts/bank-account             → masked account info
DELETE /api/payouts/bank-account             → remove (also deletes Paystack recipient)
```

`POST /api/payouts/bank-account`
```json
{ "accountNumber": "0123456789", "bankCode": "058", "accountName": "JADE SMITH" }
```
→ `accountName` is optional; it's auto-resolved via Paystack when omitted.

Saved account response (number is **never** returned in plaintext):
```json
{
  "message": "Bank account saved",
  "account": {
    "id": "<uuid>",
    "bankCode": "058",
    "bankName": "Guaranty Trust Bank",
    "accountName": "JADE SMITH",
    "accountNumberMasked": "******6789",
    "isVerified": true
  }
}
```

### 3.5 Session completion → payout

```
PATCH /api/sessions/:sessionId/complete    (auth: the session's creative)
PATCH /api/sessions/:sessionId/confirm     (auth: the session's client)
```

- `complete` sets status `completed` + `completed_at`.
- `confirm` sets `client_confirmed_at`.
- When both are set (in any order) and payment is `confirmed`, the payout
  fires automatically inside the same request. Response includes
  `{ payout: { status, amount, transferCode, createdAt } }` when released.

### 3.6 Payout status

```
GET /api/payouts/:sessionId    (auth: client or creative of the session)
```

```json
{
  "payout": {
    "sessionId": "<uuid>",
    "creativeId": "<uuid>",
    "amount": 35000,
    "status": "processing",     // pending | processing | completed | failed
    "transferCode": "TRF-...",
    "createdAt": "2026-08-28T12:00:00.000Z",
    "updatedAt": "2026-08-28T12:00:05.000Z"
  }
}
```

---

## 4. Frontend Integration Notes

1. **Initiate** → receive `paystackAuthorizationUrl` → open it in a
   webview/in-app browser (or use the Paystack JS SDK with
   `PAYSTACK_PUBLIC_KEY` + the returned `reference`).
2. **On webview close/redirect** (user lands on
   `PAYSTACK_CALLBACK_URL?reference=...`), call
   `GET /api/payments/verify?reference=...` and show the result.
   ⚠️ This is a **fallback** — the webhook may arrive later, so treat the
   webhook as truth and `verify` as a UI convenience.
3. **"Creative hasn't set up payout account" (400)** — when a payout can't
   fire, show the creative an in-app prompt linking to the bank account
   setup screen.
4. **409 Payment already in progress** — disable the pay button; the user
   already has a pending checkout for this session.
5. **502 Paystack errors** — show "Payment provider is unreachable, please
   retry" and keep the pay button enabled. Failed initializations are
   marked `failed` server-side so a retry reuses the same reference.
6. **Timeouts & retries** — `verify` can be polled up to 3 times at 3s
   intervals after webview close. If still not confirmed, rely on the
   webhook and in-app notifications (`payment_processed`) instead.

---

## 5. Testing Plan

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Initiate with no session amount | `400 Session has no agreed amount` |
| 2 | Initiate with mismatched amount | `400 Amount does not match...` |
| 3 | Initiate twice in a row | 2nd → `409 Payment already in progress` |
| 4 | Non-client initiates | `403` |
| 5 | Webhook with bad signature | `401 Invalid webhook signature` |
| 6 | `charge.success` webhook | Payment `confirmed` + notifications |
| 7 | Creative completes before client confirms | Session completed, **no payout** yet |
| 8 | Client confirms before creative completes | Confirmed, **no payout** yet |
| 9 | Both complete + confirm, no bank account | `400 Creative hasn't set up payout account` |
| 10 | Both complete + confirm + account | Payout `processing`, `transferCode` returned |
| 11 | `transfer.success` webhook | Payout `completed` |
| 12 | Payout status by non-involved user | `403` |

> Use Paystack **test mode** (`sk_test_...`) for everything. Unit tests:
> `npm run test:payments` (13 tests — fee split, kobo conversion, reference
> determinism, webhook signature verification, account masking).

---

## 6. Security & Assumptions

- Account numbers are stored **AES-256-GCM encrypted** with
  `MESSAGE_ENCRYPTION_KEY` (same mechanism as message encryption).
- Amounts are validated server-side against `session.agreed_amount`.
  Frontend amounts are ignored.
- Payout rows are UNIQUE per session; transfers reuse deterministic
  references so retries can't double-pay.
- Session rows are locked (`SELECT ... FOR UPDATE`) during payment
  initiation and payout triggering to prevent races.
- **Deviation from spec:** we do NOT use native Paystack split/subreach —
  funds are held in the platform balance and transferred manually (as
  requested). 30% fee is simply the un-transferred remainder.
- **Assumption:** one payment row per session (unique constraint). Retries
  reuse the same row and reference.
- **Manual fallback:** if a transfer webhook is missed, polling
  `GET /api/payouts/:sessionId` refreshes status from Paystack when the
  payout is non-terminal.
