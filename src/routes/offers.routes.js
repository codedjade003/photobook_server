import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  sendOfferController,
  listOffersController,
  acceptOfferController,
  declineOfferController,
  cancelOfferController
} from "../controllers/offer.controller.js";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Offer:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         created_by: { type: string, format: uuid }
 *         sent_to: { type: string, format: uuid }
 *         service_name: { type: string }
 *         description: { type: string, nullable: true }
 *         pricing_amount: { type: number }
 *         currency_code: { type: string, example: NGN }
 *         pricing_mode: { type: string, enum: [fixed, contact] }
 *         categories: { type: array, items: { type: string } }
 *         whats_included: { type: array, items: { type: string } }
 *         delivery_time: { type: string, nullable: true }
 *         quantity_label: { type: string, nullable: true }
 *         quantity_max: { type: number, nullable: true }
 *         status: { type: string, enum: [pending, accepted, declined, cancelled] }
 *         session_id: { type: string, format: uuid, nullable: true }
 *         session_date: { type: string, nullable: true }
 *         session_time: { type: string, nullable: true }
 *         location_type: { type: string, enum: [indoor, outdoor], nullable: true }
 *         location_text: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 */

/**
 * @swagger
 * /api/offers:
 *   post:
 *     summary: Send a custom offer to another user
 *     description: |
 *       Sends a personalized service offer. Works in both directions:
 *       - Photographers send offers to clients with custom pricing
 *       - Clients can also send offer requests to photographers
 *       Upon acceptance, a session is auto-booked.
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sentTo, serviceName, pricingAmount]
 *             properties:
 *               sentTo: { type: string, format: uuid, description: "User ID of the recipient" }
 *               serviceName: { type: string, example: Custom Wedding Package }
 *               pricingAmount: { type: number, example: 250000 }
 *               pricingMode: { type: string, enum: [fixed, contact], default: fixed }
 *               currencyCode: { type: string, default: NGN, example: NGN }
 *               description: { type: string, example: Tailored wedding package with extra hours }
 *               categories:
 *                 type: array
 *                 items: { type: string, enum: [weddings, birthdays, products, headshots, events, editorial, corporate, lifestyle] }
 *               whatsIncluded:
 *                 type: array
 *                 items: { type: string }
 *                 example: [600+ photos, 12-hour coverage, 3 photographers]
 *               deliveryTime: { type: string, example: 3-4 weeks }
 *               quantityLabel: { type: string, example: 12 hours }
 *               quantityMax: { type: number, example: 12 }
 *               sessionDate: { type: string, example: "2026-08-15", description: "Proposed session date" }
 *               sessionTime: { type: string, example: "09:00", description: "Proposed start time" }
 *               locationType: { type: string, enum: [indoor, outdoor] }
 *               locationText: { type: string, example: Victoria Island, Lagos }
 *     responses:
 *       201:
 *         description: Offer sent
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", auth(), sendOfferController);

/**
 * @swagger
 * /api/offers:
 *   get:
 *     summary: List your offers (sent and received)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Offers returned, grouped by direction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sent:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - { $ref: '#/components/schemas/Offer' }
 *                       - type: object
 *                         properties:
 *                           counterparty: { type: object }
 *                           direction: { type: string, enum: [sent] }
 *                 received:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - { $ref: '#/components/schemas/Offer' }
 *                       - type: object
 *                         properties:
 *                           counterparty: { type: object }
 *                           direction: { type: string, enum: [received] }
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth(), listOffersController);

/**
 * @swagger
 * /api/offers/{id}/accept:
 *   patch:
 *     summary: Accept a pending offer (recipient only) — auto-books a session
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Offer accepted, session booked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 offer: { $ref: '#/components/schemas/Offer' }
 *                 session: { type: object, description: The newly created session }
 *       400:
 *         description: Offer not pending or already processed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (only the recipient can accept)
 *       404:
 *         description: Offer not found
 */
router.patch("/:id/accept", auth(), acceptOfferController);

/**
 * @swagger
 * /api/offers/{id}/decline:
 *   patch:
 *     summary: Decline a pending offer (recipient only)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Offer declined
 *       400:
 *         description: Offer not pending or already processed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Offer not found
 */
router.patch("/:id/decline", auth(), declineOfferController);

/**
 * @swagger
 * /api/offers/{id}/cancel:
 *   patch:
 *     summary: Cancel your own pending offer (sender only)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Offer cancelled
 *       400:
 *         description: Offer not pending or already processed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (only the sender can cancel)
 *       404:
 *         description: Offer not found
 */
router.patch("/:id/cancel", auth(), cancelOfferController);

export default router;
