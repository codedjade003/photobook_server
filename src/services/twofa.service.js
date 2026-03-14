import speakeasy from "speakeasy";
import QRCode from "qrcode";

const appName = process.env.APP_NAME || "Photobook";

/**
 * Generate a new 2FA secret for a user
 */
export const generateTwoFASecret = async (email) => {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${email})`,
    issuer: appName,
    length: 32
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);

  return {
    secret: secret.base32,
    qrCodeUrl,
    backupCodes,
    otpauth_url: secret.otpauth_url
  };
};

/**
 * Verify a TOTP token
 */
export const verifyTwoFAToken = (token, secret) => {
  try {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2 // Allow for time drift (30 seconds before and after)
    });
    return verified;
  } catch (err) {
    console.error("2FA verification error:", err);
    return false;
  }
};

/**
 * Generate backup codes
 */
export const generateBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

/**
 * Validate a backup code format
 */
export const isValidBackupCodeFormat = (code) => {
  return /^[A-Z0-9]{8}$/.test(code);
};
