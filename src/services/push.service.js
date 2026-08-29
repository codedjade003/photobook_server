import admin, { initFirebase, isFirebaseConfigured } from "../config/firebase.js";
import {
  findTokensForUser,
  registerDeviceToken,
  removeDeviceToken
} from "../repositories/push.repo.js";

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
  "messaging/invalid-registration-token"
]);

/**
 * Send a push notification to all of a user's registered devices.
 * Silently no-ops when Firebase isn't configured or the user has no tokens.
 * Invalid/unregistered tokens are cleaned up automatically.
 *
 * @returns {Promise<{sent: number, skipped?: boolean}>}
 */
export const sendPush = async (userId, title, body, data = {}) => {
  initFirebase();
  if (!isFirebaseConfigured()) return { sent: 0, skipped: true };

  const tokens = await findTokensForUser(userId);
  if (!tokens.length) return { sent: 0 };

  let sent = 0;
  for (const token of tokens) {
    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      });
      sent += 1;
    } catch (err) {
      if (INVALID_TOKEN_CODES.has(err?.code)) {
        await removeDeviceToken({ token });
      } else {
        console.error("Push send failed:", err.message);
      }
    }
  }

  return { sent };
};

/**
 * Register (or reassign) a device token. Called by the client after login.
 */
export const registerDeviceTokenForUser = async ({ userId, token, platform }) => {
  const saved = await registerDeviceToken({ userId, token, platform });
  return saved;
};

/**
 * Remove a device token (logout / app uninstall). Optional userId scoping.
 */
export const unregisterDeviceToken = async ({ userId, token }) => {
  return removeDeviceToken({ token, userId });
};
