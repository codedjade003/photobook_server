-- 017_payments_escrow.sql
-- Paystack-based escrow payment system:
--   * Client pays full amount → held in platform Paystack balance
--   * Creative marks session complete + client confirms satisfaction
--   * 70% transferred to creative, 30% retained as platform fee

-- ─────────────────────────────────────────────────────────────
-- 1) Escrow fields on sessions
-- ─────────────────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(12,2)
    CHECK (agreed_amount IS NULL OR agreed_amount > 0),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 2) Payments (inbound: client → platform)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  reference VARCHAR(64) NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed')),
  paystack_response JSONB,
  initiated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3) Payouts (outbound: platform → creative)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  creative_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  recipient_code VARCHAR(64),
  transfer_code VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  paystack_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_creative ON payouts(creative_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4) Creative bank accounts (outbound recipients)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creative_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bank_code VARCHAR(20) NOT NULL,
  bank_name VARCHAR(120),
  account_number_encrypted TEXT NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  recipient_code VARCHAR(64) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_recipient ON creative_bank_accounts(recipient_code);
