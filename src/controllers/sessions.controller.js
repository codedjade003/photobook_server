import {
  createSession,
  deleteSessionById,
  findSessionById,
  listEventTypes,
  listMySessions
} from "../repositories/session.repo.js";
import { findRateCardItemById } from "../repositories/rateCard.repo.js";
import { findUserById } from "../repositories/user.repo.js";
import {
  photographerBookingSchema,
  videographerBookingSchema,
  contentCreatorBookingSchema
} from "../validators/session.schema.js";
import { handleRequest } from "../utils/http.js";
import { hasDevOverridePassword } from "../utils/devAccess.js";
import { notify } from "./notification.controller.js";
import {
  acceptBooking,
  completeSession,
  confirmSession,
  declineBooking
} from "../services/payment.service.js";

const CREATIVE_SCHEMAS = {
  photographer: photographerBookingSchema,
  videographer: videographerBookingSchema,
  content_creator: contentCreatorBookingSchema
};

export const listEventTypesController = (req, res) => {
  return handleRequest(res, async () => {
    const { creativeType, photographerId } = req.query;
    let creativeTypes = null;

    if (creativeType) {
      creativeTypes = [creativeType];
    } else if (photographerId) {
      const photographer = await findUserById(photographerId);
      if (photographer?.creative_types?.length) {
        creativeTypes = photographer.creative_types;
      }
    }

    const eventTypes = await listEventTypes(creativeTypes);
    res.json({ eventTypes });
  });
};

export const createSessionController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "client") throw new Error("forbidden");

    const { photographerId, creativeType } = req.body;
    const photographer = await findUserById(photographerId);
    if (!photographer) return res.status(404).json({ message: "Photographer not found" });

    // The client chooses which subtype they're hiring the creative as.
    const chosenType = creativeType || (photographer.creative_types?.[0]) || "photographer";

    if (
      photographer.creative_types?.length &&
      !photographer.creative_types.includes(chosenType)
    ) {
      return res.status(400).json({
        message: `Creative does not offer "${chosenType}". Available: ${photographer.creative_types.join(", ")}`
      });
    }

    const schema = CREATIVE_SCHEMAS[chosenType] || photographerBookingSchema;
    const payload = schema.parse(req.body);

    // Package price comes from the rate card — never the frontend.
    const rateCardItem = await findRateCardItemById(payload.rateCardItemId);
    if (!rateCardItem) return res.status(404).json({ message: "Rate card item not found" });
    if (rateCardItem.photographer_id !== photographerId) {
      return res.status(400).json({ message: "Rate card item does not belong to this creative" });
    }

    const agreedAmount = rateCardItem.pricing_amount ?? null;
    const packageType = rateCardItem.service_name;

    const session = await createSession({
      clientId: req.user.id,
      payload,
      agreedAmount,
      packageType,
      rateCardItemId: rateCardItem.id,
      creativeType: chosenType
    });

    // Fire notification (don't block response)
    notify.bookingConfirmed({
      clientId: req.user.id,
      photographerId: payload.photographerId,
      session
    }).catch((err) => console.error("Booking notification failed:", err.message));

    res.status(201).json({ message: "Session booked", session });
  });
};

export const listMySessionsController = (req, res) => {
  return handleRequest(res, async () => {
    const sessions = await listMySessions({ userId: req.user.id, role: req.user.role });
    res.json({ sessions });
  });
};

export const deleteSessionController = (req, res) => {
  return handleRequest(res, async () => {
    const session = await findSessionById(req.params.sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const isDevOverride = await hasDevOverridePassword(req);
    const isOwner = req.user
      && (req.user.id === session.client_id || req.user.id === session.photographer_id);

    if (!isOwner && !isDevOverride) throw new Error("forbidden");

    const deleted = await deleteSessionById(req.params.sessionId);

    // Fire cancellation notification
    notify.bookingCanceled({
      clientId: deleted.client_id,
      photographerId: deleted.photographer_id,
      session: deleted
    }).catch((err) => console.error("Cancel notification failed:", err.message));

    res.json({ message: "Session deleted", session: deleted });
  });
};

export const completeSessionController = (req, res) => {
  return handleRequest(res, async () => {
    const result = await completeSession({
      userId: req.user.id,
      sessionId: req.params.sessionId
    });
    res.json({
      message: result.payout ? "Session completed and payout released" : "Session marked complete",
      ...result
    });
  });
};

export const confirmSessionController = (req, res) => {
  return handleRequest(res, async () => {
    const result = await confirmSession({
      userId: req.user.id,
      sessionId: req.params.sessionId
    });
    res.json({
      message: result.payout ? "Session confirmed and payout released" : "Session confirmed",
      ...result
    });
  });
};

export const acceptSessionController = (req, res) => {
  return handleRequest(res, async () => {
    const session = await acceptBooking({
      userId: req.user.id,
      sessionId: req.params.sessionId
    });
    res.json({ message: "Booking accepted", session });
  });
};

export const declineSessionController = (req, res) => {
  return handleRequest(res, async () => {
    const session = await declineBooking({
      userId: req.user.id,
      sessionId: req.params.sessionId
    });
    res.json({ message: "Booking declined", session });
  });
};
