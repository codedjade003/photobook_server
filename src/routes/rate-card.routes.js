import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  createRateCardItemController,
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
 */
router.post("/", auth(["photographer"]), createRateCardItemController);

/**
 * @swagger
 * /api/rate-card/{photographerId}:
 *   get:
 *     summary: Public rate card for a photographer
 *     tags: [RateCard]
 */
router.get("/:photographerId", getPhotographerRateCardController);

export default router;
