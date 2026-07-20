import { createOfferSchema } from "../validators/offer.schema.js";
import {
  sendOffer,
  getMyOffers,
  acceptOffer,
  declineOffer,
  cancelOffer
} from "../services/offer.service.js";
import { handleRequest } from "../utils/http.js";

/**
 * POST /api/offers
 */
export const sendOfferController = (req, res) => {
  return handleRequest(res, async () => {
    const payload = createOfferSchema.parse(req.body);
    const offer = await sendOffer({ userId: req.user.id, payload });
    res.status(201).json({ message: "Offer sent", offer });
  });
};

/**
 * GET /api/offers
 */
export const listOffersController = (req, res) => {
  return handleRequest(res, async () => {
    const offers = await getMyOffers(req.user.id);
    res.json(offers);
  });
};

/**
 * PATCH /api/offers/:id/accept
 */
export const acceptOfferController = (req, res) => {
  return handleRequest(res, async () => {
    const result = await acceptOffer({ userId: req.user.id, offerId: req.params.id });
    res.json({
      message: "Offer accepted — session booked",
      offer: result.offer,
      session: result.session
    });
  });
};

/**
 * PATCH /api/offers/:id/decline
 */
export const declineOfferController = (req, res) => {
  return handleRequest(res, async () => {
    const offer = await declineOffer({ userId: req.user.id, offerId: req.params.id });
    res.json({ message: "Offer declined", offer });
  });
};

/**
 * PATCH /api/offers/:id/cancel
 */
export const cancelOfferController = (req, res) => {
  return handleRequest(res, async () => {
    const offer = await cancelOffer({ userId: req.user.id, offerId: req.params.id });
    res.json({ message: "Offer cancelled", offer });
  });
};
