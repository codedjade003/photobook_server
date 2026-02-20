import { Router } from "express";
import {
  signup,
  login,
  verifyEmail,
  requestPasswordReset,
  confirmPasswordReset,
  me,
  updateRole
} from "../controllers/auth.controller.js";
import auth from "../middleware/auth.js";

const router = Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register user and return auth token
 *     tags: [Auth]
 *     description: Creates a new user account. Returns JWT token and user payload.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Jade }
 *               email: { type: string, example: jade@example.com }
 *               password: { type: string, example: Password123 }
 *               role: { type: string, enum: [client, photographer], example: client }
 *     responses:
 *       201:
 *         description: Signup successful
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post("/signup", signup);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email/password
 *     tags: [Auth]
 *     description: Authenticates a user and returns JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: jade@example.com }
 *               password: { type: string, example: Password123 }
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email with code (no-op when EMAIL_FEATURE_ENABLED=false)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, example: jade@example.com }
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Email verified or verification bypassed
 *       400:
 *         description: Invalid code or validation error
 *       404:
 *         description: User not found
 */
router.post("/verify-email", verifyEmail);

/**
 * @swagger
 * /api/auth/password-reset/request:
 *   post:
 *     summary: Request password reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: jade@example.com }
 *     responses:
 *       200:
 *         description: Reset code generated
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
router.post("/password-reset/request", requestPasswordReset);

/**
 * @swagger
 * /api/auth/password-reset/confirm:
 *   post:
 *     summary: Confirm password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code, newPassword]
 *             properties:
 *               email: { type: string, example: jade@example.com }
 *               code: { type: string, example: "123456" }
 *               newPassword: { type: string, example: NewPassword123 }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid code, expired code, or validation error
 *       404:
 *         description: User not found
 */
router.post("/password-reset/confirm", confirmPasswordReset);

/**
 * @swagger
 * /api/auth/role:
 *   patch:
 *     summary: Set or change role (client or photographer)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [client, photographer], example: photographer }
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.patch("/role", auth(), updateRole);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user returned
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get("/me", auth(), me);

export default router;
