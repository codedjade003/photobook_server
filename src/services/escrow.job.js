import { ESCROW_AUTO_RELEASE_DAYS, isPaystackConfigured } from "../config/payments.js";
import { releaseExpiredEscrows } from "./payment.service.js";

// Escrow can't depend on the client remembering to press "confirm". Once
// deliverables have been sent and the auto-release window has passed with no
// confirmation and no refund, the funds are released to the creative.

let intervalHandle = null;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SWEEP_INTERVAL_MS = parsePositiveInt(
  process.env.ESCROW_SWEEP_INTERVAL_MS,
  60 * 60 * 1000
);

const sweep = async () => {
  try {
    const results = await releaseExpiredEscrows({ limit: 50 });
    const released = results.filter((r) => r.released).length;
    if (results.length) {
      console.log(
        `[escrow] auto-release sweep: ${released}/${results.length} released`
      );
    }
  } catch (err) {
    console.error("[escrow] auto-release sweep failed:", err.message);
  }
};

export const startEscrowJob = () => {
  if (intervalHandle) return;

  if (!isPaystackConfigured()) {
    console.warn("[escrow] auto-release job not started (Paystack not configured)");
    return;
  }

  console.log(
    `[escrow] auto-release job started (every ${SWEEP_INTERVAL_MS / 1000}s, ` +
    `${ESCROW_AUTO_RELEASE_DAYS}-day hold)`
  );
  intervalHandle = setInterval(sweep, SWEEP_INTERVAL_MS);
  if (typeof intervalHandle.unref === "function") intervalHandle.unref();
  sweep();
};

export const stopEscrowJob = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
