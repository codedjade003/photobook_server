import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  deleteUserById,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  setEmailVerification,
  setVerificationFailureState,
  setPasswordReset,
  updatePassword,
  updateUserRole,
  updateUserProfile,
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
import { isTruthyEnv } from "../utils/env.js";
import { buildPasswordResetEmail, buildVerificationEmail } from "../templates/email.templates.js";

const signToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
  );
};

const generateCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const EMAIL_CODE_TTL_MINUTES = parsePositiveInt(process.env.VERIFICATION_CODE_TTL_MINUTES, 15);
const EMAIL_MAX_VERIFY_ATTEMPTS = parsePositiveInt(process.env.VERIFICATION_MAX_ATTEMPTS, 5);
const EMAIL_VERIFY_LOCKOUT_MINUTES = parsePositiveInt(process.env.VERIFICATION_LOCKOUT_MINUTES, 15);
const EMAIL_RESEND_MAX_ATTEMPTS = parsePositiveInt(process.env.VERIFICATION_RESEND_MAX_ATTEMPTS, 3);
const EMAIL_RESEND_WINDOW_MINUTES = parsePositiveInt(process.env.VERIFICATION_RESEND_WINDOW_MINUTES, 60);
const EMAIL_RESEND_COOLDOWN_SECONDS = parsePositiveInt(process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS, 60);

const buildVerificationExpiry = () => new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60 * 1000);

const sendVerificationCodeEmail = async (email, code) => {
  const emailContent = buildVerificationEmail({
    code,
    expiryMinutes: EMAIL_CODE_TTL_MINUTES
  });
  await sendEmail({
    to: email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html
  });
};

export const signupUser = async ({ name, email, password, role }) => {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email already exists");

  const rounds = process.env.BCRYPT_ROUNDS ? Number(process.env.BCRYPT_ROUNDS) : 10;
  const passwordHash = await bcrypt.hash(password, rounds);

  const emailEnabled = isTruthyEnv(process.env.EMAIL_FEATURE_ENABLED);
  const user = await createUser({
    name,
    email,
    passwordHash,
    role,
    emailVerified: !emailEnabled
  });

  if (emailEnabled) {
    try {
      const code = generateCode();
      const now = new Date();
      const expiresAt = buildVerificationExpiry();
      await setEmailVerification({
        userId: user.id,
        code,
        expiresAt,
        resendCount: 1,
        resendWindowStartedAt: now,
        sentAt: now
      });
      await sendVerificationCodeEmail(user.email, code);
    } catch (err) {
      await deleteUserById(user.id);
      throw new Error("Unable to send verification code. Please try again.");
    }
  }

  await ensureRoleProfile({ userId: user.id, role: user.role });
  const token = emailEnabled ? null : signToken(user);
  return { user, token };
};

export const loginUser = async ({ email, password }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Invalid credentials");

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error("Invalid credentials");
  if (isTruthyEnv(process.env.EMAIL_FEATURE_ENABLED) && !user.email_verified) {
    throw new Error("Email not verified");
  }

  const token = signToken(user);
  return { user, token };
};

export const verifyEmailCode = async ({ email, code }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");
  if (!isTruthyEnv(process.env.EMAIL_FEATURE_ENABLED)) return { user, token: signToken(user) };
  if (user.email_verified) throw new Error("Email already verified");

  const now = new Date();
  const lockedUntil = user.verification_locked_until ? new Date(user.verification_locked_until) : null;
  if (lockedUntil && lockedUntil > now) {
    throw new Error("Too many verification attempts. Please try again later");
  }

  if (!user.verification_code || user.verification_code !== code) {
    const attemptCount = (user.verification_attempt_count || 0) + 1;
    const nextLockedUntil =
      attemptCount >= EMAIL_MAX_VERIFY_ATTEMPTS
        ? new Date(now.getTime() + EMAIL_VERIFY_LOCKOUT_MINUTES * 60 * 1000)
        : null;
    await setVerificationFailureState({
      userId: user.id,
      attemptCount,
      lastAttemptAt: now,
      lockedUntil: nextLockedUntil
    });
    if (nextLockedUntil) {
      throw new Error("Too many verification attempts. Please try again later");
    }
    throw new Error("Invalid code");
  }
  if (user.verification_code_expires_at && new Date(user.verification_code_expires_at) < now) {
    const attemptCount = (user.verification_attempt_count || 0) + 1;
    const nextLockedUntil =
      attemptCount >= EMAIL_MAX_VERIFY_ATTEMPTS
        ? new Date(now.getTime() + EMAIL_VERIFY_LOCKOUT_MINUTES * 60 * 1000)
        : null;
    await setVerificationFailureState({
      userId: user.id,
      attemptCount,
      lastAttemptAt: now,
      lockedUntil: nextLockedUntil
    });
    if (nextLockedUntil) {
      throw new Error("Too many verification attempts. Please try again later");
    }
    throw new Error("Code expired");
  }

  const updated = await markEmailVerified(user.id);
  const token = signToken(updated);

  return { user: updated, token };
};

export const resendEmailVerificationCode = async ({ email }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");
  if (!isTruthyEnv(process.env.EMAIL_FEATURE_ENABLED)) {
    const code = generateCode();
    const now = new Date();
    const expiresAt = buildVerificationExpiry();
    await setEmailVerification({
      userId: user.id,
      code,
      expiresAt,
      resendCount: 1,
      resendWindowStartedAt: now,
      sentAt: now
    });
    return { code };
  }
  if (user.email_verified) throw new Error("Email already verified");

  const now = new Date();
  const windowStart = user.verification_resend_window_started_at
    ? new Date(user.verification_resend_window_started_at)
    : null;
  const shouldResetWindow =
    !windowStart || now.getTime() - windowStart.getTime() > EMAIL_RESEND_WINDOW_MINUTES * 60 * 1000;
  const resendCount = shouldResetWindow ? 0 : user.verification_resend_count || 0;

  if (resendCount >= EMAIL_RESEND_MAX_ATTEMPTS) {
    throw new Error("Verification resend limit reached. Please try again later");
  }

  const lastSentAt = user.verification_last_sent_at ? new Date(user.verification_last_sent_at) : null;
  if (lastSentAt && now.getTime() - lastSentAt.getTime() < EMAIL_RESEND_COOLDOWN_SECONDS * 1000) {
    throw new Error("Please wait before requesting another verification code");
  }

  const code = generateCode();
  const expiresAt = buildVerificationExpiry();
  await setEmailVerification({
    userId: user.id,
    code,
    expiresAt,
    resendCount: resendCount + 1,
    resendWindowStartedAt: shouldResetWindow ? now : windowStart,
    sentAt: now
  });
  await sendVerificationCodeEmail(user.email, code);

  return { success: true };
};

export const requestPasswordResetCode = async ({ email }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");

  const code = generateCode();
  const resetTtlMinutes = parsePositiveInt(process.env.PASSWORD_RESET_CODE_TTL_MINUTES, 15);
  const expiresAt = new Date(Date.now() + resetTtlMinutes * 60 * 1000);
  await setPasswordReset({ userId: user.id, code, expiresAt });

  if (isTruthyEnv(process.env.EMAIL_FEATURE_ENABLED)) {
    const emailContent = buildPasswordResetEmail({ code, expiryMinutes: resetTtlMinutes });
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html
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

export const updateProfileForUser = async ({ userId, payload }) => {
  const existing = await findUserById(userId);
  if (!existing) throw new Error("User not found");

  if (payload.email && payload.email.toLowerCase() !== existing.email?.toLowerCase()) {
    const existingByEmail = await findUserByEmail(payload.email);
    if (existingByEmail && existingByEmail.id !== userId) {
      throw new Error("Email already exists");
    }
  }

  const updated = await updateUserProfile({
    userId,
    name: payload.name,
    email: payload.email,
    phone: payload.phone
  });
  const token = signToken(updated);
  return { user: updated, token };
};

// ==================== 2FA Methods ====================

export const generateTwoFASetup = async (userId) => {
  const user = await findUserById(userId) || { email: userId };
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
  const user = await findUserById(userId);
  if (!user || !user.two_fa_enabled) {
    throw new Error("2FA not enabled for this user");
  }

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
