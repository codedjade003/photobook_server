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
 */
router.post("/signup", signup);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email/password
 *     tags: [Auth]
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
 */
router.get("/me", auth(), me);

export default router;
