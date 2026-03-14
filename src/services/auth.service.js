import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmail,
  markEmailVerified,
  setEmailVerification,
  setPasswordReset,
  updatePassword,
  updateUserRole,
  enableTwoFA,
  disableTwoFA,
  setTwoFASecret,
  useBackupCode,
  updateLastLogin,
  linkGoogleOAuth,
  findUserByGoogleOAuthId
} from "../repositories/user.repo.js";
import { sendEmail } from "../config/mail.js";
import { ensureRoleProfile } from "../repositories/profile.repo.js";
import { generateTwoFASecret, verifyTwoFAToken, isValidBackupCodeFormat } from "./twofa.service.js";

const signToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
};

const generateCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

export const signupUser = async ({ name, email, password, role }) => {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email already exists");

  const rounds = process.env.BCRYPT_ROUNDS ? Number(process.env.BCRYPT_ROUNDS) : 10;
  const passwordHash = await bcrypt.hash(password, rounds);

  const emailEnabled = process.env.EMAIL_FEATURE_ENABLED === "true";
  const user = await createUser({
    name,
    email,
    passwordHash,
    role,
    emailVerified: !emailEnabled
  });

  if (emailEnabled) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await setEmailVerification({ userId: user.id, code, expiresAt });
    const templateId = process.env.RESEND_EMAIL_VERIFICATION_TEMPLATE_ID;
    await sendEmail({
      to: user.email,
      templateId,
      templateVariables: { code },
      subject: "Verify your email",
      text: `Your verification code is: ${code}`
    });
  }

  await ensureRoleProfile({ userId: user.id, role: user.role });
  const token = signToken(user);
  return { user, token };
};

export const loginUser = async ({ email, password }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Invalid credentials");

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error("Invalid credentials");
  if (process.env.EMAIL_FEATURE_ENABLED === "true" && !user.email_verified) {
    throw new Error("Email not verified");
  }

  const token = signToken(user);
  return { user, token };
};

export const verifyEmailCode = async ({ email, code }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");
  if (process.env.EMAIL_FEATURE_ENABLED !== "true") return { user, token: signToken(user) };
  if (user.email_verified) throw new Error("Email already verified");

  if (!user.verification_code || user.verification_code !== code) {
    throw new Error("Invalid code");
  }
  if (user.verification_code_expires_at && new Date(user.verification_code_expires_at) < new Date()) {
    throw new Error("Code expired");
  }

  const updated = await markEmailVerified(user.id);
  const token = signToken(updated);

  return { user: updated, token };
};

export const requestPasswordResetCode = async ({ email }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await setPasswordReset({ userId: user.id, code, expiresAt });

  if (process.env.EMAIL_FEATURE_ENABLED === "true") {
    const templateId = process.env.RESEND_PASSWORD_RESET_TEMPLATE_ID;
    await sendEmail({
      to: user.email,
      templateId,
      templateVariables: { code },
      subject: "Password reset code",
      text: `Your password reset code is: ${code}`
    });
  }
  return { code };
};

export const confirmPasswordResetCode = async ({ email, code, newPassword }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");

  if (!user.reset_code || user.reset_code !== code) {
    throw new Error("Invalid code");
  }
  if (user.reset_code_expires_at && new Date(user.reset_code_expires_at) < new Date()) {
    throw new Error("Code expired");
  }

  const rounds = process.env.BCRYPT_ROUNDS ? Number(process.env.BCRYPT_ROUNDS) : 10;
  const passwordHash = await bcrypt.hash(newPassword, rounds);
  const updated = await updatePassword({ userId: user.id, passwordHash });
  const token = signToken(updated);

  return { user: updated, token };
};

export const updateRoleForUser = async ({ userId, role }) => {
  const updated = await updateUserRole({ userId, role });
  if (!updated) throw new Error("User not found");
  await ensureRoleProfile({ userId, role });
  const token = signToken(updated);
  return { user: updated, token };
};

// ==================== 2FA Methods ====================

export const generateTwoFASetup = async (userId) => {
  const user = await findUserByEmail(userId) || { email: userId };
  if (user.two_fa_enabled) {
    throw new Error("2FA is already enabled for this user");
  }

  const twoFAData = await generateTwoFASecret(user.email);
  return twoFAData;
};

export const enableUserTwoFA = async ({ userId, token, secret, backupCodes }) => {
  // Verify the token first
  const isValid = verifyTwoFAToken(token, secret);
  if (!isValid) {
    throw new Error("Invalid 2FA token");
  }

  // Update user with 2FA secret
  await setTwoFASecret({ userId, secret, backupCodes });
  const user = await enableTwoFA(userId);

  return { user, message: "2FA enabled successfully" };
};

export const disableUserTwoFA = async (userId) => {
  const user = await disableTwoFA(userId);
  return { user, message: "2FA disabled successfully" };
};

export const verifyUserTwoFAToken = async (userId, token, backupCode = null) => {
  const { rows } = await findUserByEmail(userId);
  if (!rows || !rows[0] || !rows[0].two_fa_enabled) {
    throw new Error("2FA not enabled for this user");
  }

  const user = rows[0];

  // Try to verify with backup code first
  if (backupCode) {
    if (!isValidBackupCodeFormat(backupCode)) {
      throw new Error("Invalid backup code format");
    }
    try {
      await useBackupCode({ userId, code: backupCode });
      return { success: true, method: "backup-code" };
    } catch (err) {
      throw new Error("Invalid or already used backup code");
    }
  }

  // Verify with TOTP token
  const isValid = verifyTwoFAToken(token, user.two_fa_secret);
  if (!isValid) {
    throw new Error("Invalid 2FA token");
  }

  return { success: true, method: "totp" };
};

// ==================== Google OAuth Methods ====================

export const handleGoogleOAuthCallback = async (profile) => {
  const email = profile.emails?.[0]?.value;
  if (!email) {
    throw new Error("No email found in Google profile");
  }

  let user = await findUserByEmail(email);

  if (!user) {
    // Create new user
    const passwordRounds = process.env.BCRYPT_ROUNDS ? Number(process.env.BCRYPT_ROUNDS) : 10;
    const randomPassword = Math.random().toString(36).slice(-12); // Generate random password
    const passwordHash = await bcrypt.hash(randomPassword, passwordRounds);

    user = await createUser({
      name: profile.displayName || email.split("@")[0],
      email,
      passwordHash,
      role: "client",
      emailVerified: true // Google verified emails
    });
    await ensureRoleProfile({ userId: user.id, role: "client" });
  }

  // Link Google OAuth ID
  if (profile.id && !user.google_oauth_id) {
    user = await linkGoogleOAuth({ userId: user.id, googleOAuthId: profile.id });
  }

  // Update last login
  await updateLastLogin(user.id);

  const token = signToken(user);
  return { user, token };
};

export const findOrCreateOAuthUser = async (profile) => {
  // Try to find by Google OAuth ID first
  if (profile.id) {
    const userByGoogle = await findUserByGoogleOAuthId(profile.id);
    if (userByGoogle) {
      await updateLastLogin(userByGoogle.id);
      const token = signToken(userByGoogle);
      return { user: userByGoogle, token };
    }
  }

  // Fall back to email
  return await handleGoogleOAuthCallback(profile);
};
