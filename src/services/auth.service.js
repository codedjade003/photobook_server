import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmail,
  markEmailVerified,
  setEmailVerification,
  setPasswordReset,
  updatePassword,
  updateUserRole
} from "../repositories/user.repo.js";
import { sendEmail } from "../config/mail.js";
import { ensureRoleProfile } from "../repositories/profile.repo.js";

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
    await sendEmail({
      to: user.email,
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
    await sendEmail({
      to: user.email,
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
