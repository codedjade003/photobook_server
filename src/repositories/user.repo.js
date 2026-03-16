import { query } from "../config/db.js";

export const findUserByEmail = async (email) => {
  const { rows } = await query(
    "SELECT * FROM users WHERE email = $1 LIMIT 1",
    [email.toLowerCase()]
  );
  return rows[0];
};

export const findUserById = async (id) => {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0];
};

export const createUser = async ({ name, email, passwordHash, role, phone, emailVerified = false }) => {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, phone, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, email.toLowerCase(), passwordHash, role, phone || null, emailVerified]
  );
  return rows[0];
};

export const setEmailVerification = async ({
  userId,
  code,
  expiresAt,
  resendCount,
  resendWindowStartedAt,
  sentAt
}) => {
  const { rows } = await query(
    `UPDATE users
     SET verification_code = $2,
         verification_code_expires_at = $3,
         verification_attempt_count = 0,
         verification_last_attempt_at = NULL,
         verification_locked_until = NULL,
         verification_resend_count = $4,
         verification_resend_window_started_at = $5,
         verification_last_sent_at = $6
     WHERE id = $1
     RETURNING *`,
    [userId, code, expiresAt, resendCount, resendWindowStartedAt, sentAt]
  );
  return rows[0];
};

export const markEmailVerified = async (userId) => {
  const { rows } = await query(
    `UPDATE users
     SET email_verified = true,
         verification_code = NULL,
         verification_code_expires_at = NULL,
         verification_attempt_count = 0,
         verification_last_attempt_at = NULL,
         verification_locked_until = NULL,
         verification_resend_count = 0,
         verification_resend_window_started_at = NULL,
         verification_last_sent_at = NULL
     WHERE id = $1
     RETURNING *`,
    [userId]
  );
  return rows[0];
};

export const setVerificationFailureState = async ({ userId, attemptCount, lastAttemptAt, lockedUntil }) => {
  const { rows } = await query(
    `UPDATE users
     SET verification_attempt_count = $2,
         verification_last_attempt_at = $3,
         verification_locked_until = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, attemptCount, lastAttemptAt, lockedUntil]
  );
  return rows[0];
};

export const setPasswordReset = async ({ userId, code, expiresAt }) => {
  const { rows } = await query(
    `UPDATE users
     SET reset_code = $2,
         reset_code_expires_at = $3
     WHERE id = $1
     RETURNING *`,
    [userId, code, expiresAt]
  );
  return rows[0];
};

export const updatePassword = async ({ userId, passwordHash }) => {
  const { rows } = await query(
    `UPDATE users
     SET password_hash = $2,
         reset_code = NULL,
         reset_code_expires_at = NULL
     WHERE id = $1
     RETURNING *`,
    [userId, passwordHash]
  );
  return rows[0];
};

export const updateUserRole = async ({ userId, role }) => {
  const { rows } = await query(
    `UPDATE users
     SET role = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, role]
  );
  return rows[0];
};

export const deleteUserById = async (userId) => {
  const { rows } = await query(
    `DELETE FROM users
     WHERE id = $1
     RETURNING id, email, role, created_at`,
    [userId]
  );
  return rows[0];
};

export const setTwoFASecret = async ({ userId, secret, backupCodes }) => {
  const { rows } = await query(
    `UPDATE users
     SET two_fa_secret = $1,
         two_fa_backup_codes = $2
     WHERE id = $3
     RETURNING *`,
    [secret, backupCodes || [], userId]
  );
  return rows[0];
};

export const enableTwoFA = async (userId) => {
  const { rows } = await query(
    `UPDATE users
     SET two_fa_enabled = true,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId]
  );
  return rows[0];
};

export const disableTwoFA = async (userId) => {
  const { rows } = await query(
    `UPDATE users
     SET two_fa_enabled = false,
         two_fa_secret = NULL,
         two_fa_backup_codes = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId]
  );
  return rows[0];
};

export const useBackupCode = async ({ userId, code }) => {
  // Get user's backup codes
  const { rows: userRows } = await query(
    `SELECT two_fa_backup_codes FROM users WHERE id = $1`,
    [userId]
  );
  
  if (!userRows[0] || !userRows[0].two_fa_backup_codes) {
    throw new Error("No backup codes found");
  }

  const codes = userRows[0].two_fa_backup_codes;
  const codeIndex = codes.indexOf(code);
  
  if (codeIndex === -1) {
    throw new Error("Invalid backup code");
  }

  // Remove used code
  codes.splice(codeIndex, 1);
  
  const { rows } = await query(
    `UPDATE users
     SET two_fa_backup_codes = $1
     WHERE id = $2
     RETURNING *`,
    [codes, userId]
  );
  
  return rows[0];
};

export const updateLastLogin = async (userId) => {
  const { rows } = await query(
    `UPDATE users
     SET last_login_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId]
  );
  return rows[0];
};

export const findUserByGoogleOAuthId = async (googleOAuthId) => {
  const { rows } = await query(
    `SELECT * FROM users WHERE google_oauth_id = $1 LIMIT 1`,
    [googleOAuthId]
  );
  return rows[0];
};

export const linkGoogleOAuth = async ({ userId, googleOAuthId }) => {
  const { rows } = await query(
    `UPDATE users
     SET google_oauth_id = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [googleOAuthId, userId]
  );
  return rows[0];
};
