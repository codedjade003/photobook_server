import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  createRateCardItemController,
  deleteRateCardItemController,
  getMyRateCardController,
  getPhotographerRateCardController
} from "../controllers/rateCard.controller.js";

const router = Router();

/**
 * @swagger
 * /api/rate-card/me:
 *   get:
 *     summary: Get my rate card items
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rate card items returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires photographer role)
 */
router.get("/me", auth(["photographer"]), getMyRateCardController);

/**
 * @swagger
 * /api/rate-card:
 *   post:
 *     summary: Add one rate card item
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serviceName, pricingMode]
 *             properties:
 *               serviceName: { type: string, example: Corporate Event - Indoor }
 *               quantityLabel: { type: string, example: 50 people }
 *               quantityMax: { type: number, example: 50 }
 *               pricingMode: { type: string, enum: [fixed, contact], example: fixed }
 *               pricingAmount: { type: number, example: 150000 }
 *               currencyCode: { type: string, example: NGN }
 *               sortOrder: { type: number, example: 1 }
 *     responses:
 *       201:
 *         description: Rate card item created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires photographer role)
 */
router.post("/", auth(["photographer"]), createRateCardItemController);

/**
 * @swagger
 * /api/rate-card/{photographerId}:
 *   get:
 *     summary: Public rate card for a photographer
 *     tags: [RateCard]
 *     responses:
 *       200:
 *         description: Public rate card returned
 */
router.get("/:photographerId", getPhotographerRateCardController);

/**
 * @swagger
 * /api/rate-card/items/{itemId}:
 *   delete:
 *     summary: Delete rate card item (owner token or dev override password)
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rate card item deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Rate card item not found
 */
router.delete("/items/:itemId", auth([], { optional: true }), deleteRateCardItemController);

export default router;
