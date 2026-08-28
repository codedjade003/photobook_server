import {
  createSession,
  deleteSessionById,
  findSessionById,
  listEventTypes,
  listMySessions
} from "../repositories/session.repo.js";
import { findUserById } from "../repositories/user.repo.js";
import {
  photographerBookingSchema,
  videographerBookingSchema,
  contentCreatorBookingSchema
} from "../validators/session.schema.js";
import { handleRequest } from "../utils/http.js";
import { hasDevOverridePassword } from "../utils/devAccess.js";
import { notify } from "./notification.controller.js";
import { completeSession, confirmSession } from "../services/payment.service.js";

const CREATIVE_SCHEMAS = {
  photographer: photographerBookingSchema,
  videographer: videographerBookingSchema,
  content_creator: contentCreatorBookingSchema
};

export const listEventTypesController = (req, res) => {
  return handleRequest(res, async () => {
    const { photographerId } = req.query;
    let creativeTypes = null;

    if (photographerId) {
      const photographer = await findUserById(photographerId);
      if (photographer?.creative_type) {
        creativeTypes = [photographer.creative_type];
      }
    }

    const eventTypes = await listEventTypes(creativeTypes);
    res.json({ eventTypes });
  });
};

export const createSessionController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "client") throw new Error("forbidden");

    const { photographerId } = req.body;
    const photographer = await findUserById(photographerId);
    if (!photographer) return res.status(404).json({ message: "Photographer not found" });

    const creativeType = photographer.creative_type || "photographer";
    const schema = CREATIVE_SCHEMAS[creativeType] || photographerBookingSchema;

    const payload = schema.parse(req.body);
    const session = await createSession({ clientId: req.user.id, payload });

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
