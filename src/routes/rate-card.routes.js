import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  createRateCardItemController,
  deleteRateCardItemController,
  getMyRateCardController,
  getPhotographerRateCardController,
  updateRateCardItemController
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
 * components:
 *   schemas:
 *     RateCardItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         service_name: { type: string, example: Corporate Event - Indoor }
 *         quantity_label: { type: string, nullable: true, example: 50 people }
 *         quantity_max: { type: number, nullable: true, example: 50 }
 *         pricing_mode: { type: string, enum: [fixed, contact], example: fixed }
 *         pricing_amount: { type: number, example: 150000 }
 *         currency_code: { type: string, example: NGN }
 *         sort_order: { type: number, example: 1 }
 *         categories:
 *           type: array
 *           items: { type: string, enum: [weddings, birthdays, products, headshots, events, editorial, corporate, lifestyle] }
 *           example: [events, corporate]
 *         description: { type: string, nullable: true, example: Full-day corporate event coverage with editing }
 *         whats_included:
 *           type: array
 *           items: { type: string }
 *           example: [200+ edited photos, Online gallery, Drone shots]
 *         delivery_time: { type: string, nullable: true, example: 5-7 business days }
 *         active: { type: boolean, example: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 */

/**
 * @swagger
 * /api/rate-card:
 *   post:
 *     summary: Add one rate card item
 *     description: Creates a new service on your rate card. Only name and price are required — all other fields are optional.
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serviceName, pricingAmount]
 *             properties:
 *               serviceName: { type: string, example: Corporate Event - Indoor }
 *               pricingAmount: { type: number, example: 150000 }
 *               pricingMode: { type: string, enum: [fixed, contact], default: fixed, example: fixed }
 *               quantityLabel: { type: string, example: 50 people }
 *               quantityMax: { type: number, example: 50 }
 *               currencyCode: { type: string, default: NGN, example: NGN }
 *               sortOrder: { type: number, default: 0, example: 1 }
 *               categories:
 *                 type: array
 *                 items: { type: string, enum: [weddings, birthdays, products, headshots, events, editorial, corporate, lifestyle] }
 *                 maxItems: 5
 *                 example: [events, corporate]
 *               description: { type: string, maxLength: 1000, example: Full-day corporate event coverage with professional editing }
 *               whatsIncluded:
 *                 type: array
 *                 items: { type: string }
 *                 maxItems: 30
 *                 example: [200+ edited photos, Online gallery, Drone shots, 2 photographer team]
 *               deliveryTime: { type: string, maxLength: 200, example: 5-7 business days }
 *     responses:
 *       201:
 *         description: Rate card item created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 item: { $ref: '#/components/schemas/RateCardItem' }
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

/**
 * @swagger
 * /api/rate-card/items/{itemId}:
 *   put:
 *     summary: Replace/update a rate card item (owner token or dev override password)
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serviceName: { type: string, example: Wedding Coverage }
 *               pricingAmount: { type: number, example: 250000 }
 *               pricingMode: { type: string, enum: [fixed, contact] }
 *               quantityLabel: { type: string, example: 6 hours }
 *               quantityMax: { type: number, example: 6 }
 *               currencyCode: { type: string, example: NGN }
 *               sortOrder: { type: number, example: 1 }
 *               categories:
 *                 type: array
 *                 items: { type: string, enum: [weddings, birthdays, products, headshots, events, editorial, corporate, lifestyle] }
 *               description: { type: string, maxLength: 1000 }
 *               whatsIncluded:
 *                 type: array
 *                 items: { type: string }
 *               deliveryTime: { type: string, maxLength: 200 }
 *     responses:
 *       200:
 *         description: Rate card item updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Rate card item not found
 *   patch:
 *     summary: Partially update a rate card item (owner token or dev override password)
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serviceName: { type: string }
 *               pricingAmount: { type: number }
 *               pricingMode: { type: string, enum: [fixed, contact] }
 *               quantityLabel: { type: string }
 *               quantityMax: { type: number }
 *               currencyCode: { type: string }
 *               sortOrder: { type: number }
 *               categories:
 *                 type: array
 *                 items: { type: string, enum: [weddings, birthdays, products, headshots, events, editorial, corporate, lifestyle] }
 *               description: { type: string, maxLength: 1000 }
 *               whatsIncluded:
 *                 type: array
 *                 items: { type: string }
 *               deliveryTime: { type: string, maxLength: 200 }
 *     responses:
 *       200:
 *         description: Rate card item updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Rate card item not found
 */
router.put("/items/:itemId", auth([], { optional: true }), updateRateCardItemController);
router.patch("/items/:itemId", auth([], { optional: true }), updateRateCardItemController);

export default router;
