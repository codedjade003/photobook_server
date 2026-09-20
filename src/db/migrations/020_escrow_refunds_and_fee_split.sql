-- 020_escrow_refunds_and_fee_split.sql
-- Completes the escrow lifecycle:
--   * Full refunds back to the client when requirements are not fulfilled
--   * Explicit recording of the platform fee kept on each payout
--   * An auto-release deadline so unconfirmed deliverables don't strand funds

-- ─────────────────────────────────────────────────────────────
-- 1) Payments: refund-aware statuses
-- ─────────────────────────────────────────────────────────────
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'confirmed', 'failed', 'refund_pending', 'refunded'));

-- ─────────────────────────────────────────────────────────────
-- 2) Payouts: record the split explicitly.
-- gross_amount is what the client paid, platform_fee is our cut, and
-- amount (existing column) stays the net transferred to the creative.
-- Backfilled from the historical 70/30 split for existing rows.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_rate NUMERIC(5,4);

UPDATE payouts p
SET gross_amount = s.agreed_amount,
    platform_fee = ROUND(s.agreed_amount - p.amount, 2),
    fee_rate = CASE
      WHEN s.agreed_amount > 0 THEN ROUND((s.agreed_amount - p.amount) / s.agreed_amount, 4)
      ELSE 0
    END
FROM sessions s
WHERE s.id = p.session_id
  AND p.gross_amount IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3) Refunds (outbound: platform → client)
-- One refund row per session, mirroring the one-payment-per-session rule.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference VARCHAR(64) NOT NULL UNIQUE,
  reason TEXT,
  initiated_by UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  paystack_refund_id VARCHAR(64),
  paystack_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_client ON refunds(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_paystack_id ON refunds(paystack_refund_id);

-- ─────────────────────────────────────────────────────────────
-- 4) Sessions: escrow auto-release deadline
-- Set when the creative marks deliverables sent; the escrow sweep releases
-- the payout once it passes without the client either confirming or disputing.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sessions_auto_release
  ON sessions(auto_release_at)
  WHERE auto_release_at IS NOT NULL AND client_confirmed_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 5) Payout lookup by reference (webhook fallback when the transfer
-- response never reached us but Paystack still created the transfer).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS reference VARCHAR(64);

-- Must match buildTransferReference(): first 16 hex chars of the session UUID.
UPDATE payouts
SET reference = 'pbb-t-' || LEFT(REPLACE(session_id::text, '-', ''), 16)
WHERE reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_reference
  ON payouts(reference)
  WHERE reference IS NOT NULL;
