import {
  createSession,
  deleteSessionById,
  findSessionById,
  listEventTypes,
  listMySessions
} from "../repositories/session.repo.js";
import { createSessionSchema } from "../validators/session.schema.js";
import { handleRequest } from "../utils/http.js";
import { hasDevOverridePassword } from "../utils/devAccess.js";

export const listEventTypesController = (req, res) => {
  return handleRequest(res, async () => {
    const eventTypes = await listEventTypes();
    res.json({ eventTypes });
  });
};

export const createSessionController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "client") throw new Error("forbidden");
    const payload = createSessionSchema.parse(req.body);
    const session = await createSession({ clientId: req.user.id, payload });
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
    res.json({ message: "Session deleted", session: deleted });
  });
};
