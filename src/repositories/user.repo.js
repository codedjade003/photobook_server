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

export const setEmailVerification = async ({ userId, code, expiresAt }) => {
  const { rows } = await query(
    `UPDATE users
     SET verification_code = $2,
         verification_code_expires_at = $3
     WHERE id = $1
     RETURNING *`,
    [userId, code, expiresAt]
  );
  return rows[0];
};

export const markEmailVerified = async (userId) => {
  const { rows } = await query(
    `UPDATE users
     SET email_verified = true,
         verification_code = NULL,
         verification_code_expires_at = NULL
     WHERE id = $1
     RETURNING *`,
    [userId]
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
