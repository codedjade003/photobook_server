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

export const updateMyProfileByRoleController = (req, res) => {
  return handleRequest(res, async () => {
    const requestedRole = req.params.role;
    if (!["client", "photographer"].includes(requestedRole)) {
      throw new Error("Invalid role");
    }
    if (req.user.role !== requestedRole) throw new Error("forbidden");

    await ensureRoleProfile({ userId: req.user.id, role: requestedRole });

    if (requestedRole === "photographer") {
      const payload = photographerProfileSchema.parse(req.body);
      const profile = await updatePhotographerProfile({ userId: req.user.id, payload });
      return res.json({ message: "Photographer profile updated", profile });
    }

    const payload = clientProfileSchema.parse(req.body);
    const profile = await updateClientProfile({ userId: req.user.id, payload });
    return res.json({ message: "Client profile updated", profile });
  });
};
