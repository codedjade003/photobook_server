import {
  ensureRoleProfile,
  getMyProfile,
  updateClientProfile,
  updatePhotographerProfile
} from "../repositories/profile.repo.js";
import { clientProfileSchema, photographerProfileSchema } from "../validators/profile.schema.js";
import { handleRequest } from "../utils/http.js";

export const getMyProfileController = (req, res) => {
  return handleRequest(res, async () => {
    await ensureRoleProfile({ userId: req.user.id, role: req.user.role });
    const profile = await getMyProfile(req.user.id);
    res.json({ profile });
  });
};

export const updatePhotographerProfileController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "photographer") throw new Error("forbidden");
    const payload = photographerProfileSchema.parse(req.body);
    await ensureRoleProfile({ userId: req.user.id, role: "photographer" });
    const profile = await updatePhotographerProfile({ userId: req.user.id, payload });
    res.json({ message: "Photographer profile updated", profile });
  });
};

export const updateClientProfileController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "client") throw new Error("forbidden");
    const payload = clientProfileSchema.parse(req.body);
    await ensureRoleProfile({ userId: req.user.id, role: "client" });
    const profile = await updateClientProfile({ userId: req.user.id, payload });
    res.json({ message: "Client profile updated", profile });
  });
};
