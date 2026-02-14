import { createSession, listEventTypes, listMySessions } from "../repositories/session.repo.js";
import { createSessionSchema } from "../validators/session.schema.js";
import { handleRequest } from "../utils/http.js";

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
