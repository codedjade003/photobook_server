import { Router } from "express";
import auth from "../middleware/auth.js";
import { deleteMyUserController, deleteUserController } from "../controllers/users.controller.js";

const router = Router();

/**
 * @swagger
 * /api/users/me:
 *   delete:
 *     summary: Delete my account (token) or use dev override password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: Required only when calling without token but with dev password.
 *               devPassword:
 *                 type: string
 *                 description: Optional dev override password; can also be sent as x-dev-password header.
 *     responses:
 *       200:
 *         description: User deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: User deleted }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string, format: email }
 *                     role: { type: string }
 *                     created_at: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.delete("/me", auth([], { optional: true }), deleteMyUserController);

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete user account (self token or dev override password)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               devPassword:
 *                 type: string
 *                 description: Optional dev override password; can also be sent as x-dev-password header.
 *     responses:
 *       200:
 *         description: User deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: User deleted }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string, format: email }
 *                     role: { type: string }
 *                     created_at: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.delete("/:userId", auth([], { optional: true }), deleteUserController);

export default router;
