import {
  ensureRoleProfile,
  getPublicProfileById,
  getMyProfile,
  updateClientProfile,
  updatePhotographerProfile,
  updateProfilePhotoByRole
} from "../repositories/profile.repo.js";
import { clientProfileSchema, photographerProfileSchema } from "../validators/profile.schema.js";
import { handleRequest } from "../utils/http.js";
import { uploadBufferToB2 } from "../config/b2.js";

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

export const getPublicProfileController = (req, res) => {
  return handleRequest(res, async () => {
    const profile = await getPublicProfileById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    res.json({ profile });
  });
};

export const uploadAvatarController = (req, res) => {
  return handleRequest(res, async () => {
    if (!req.file) throw new Error("File is required");
    if (!req.file.mimetype.startsWith("image/")) {
      throw new Error("Invalid file type. Allowed: jpeg, jpg, png, webp");
    }

    await ensureRoleProfile({ userId: req.user.id, role: req.user.role });
    let uploaded;
    try {
      uploaded = await uploadBufferToB2({
        userId: req.user.id,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname
      });
    } catch (err) {
      console.error("Avatar upload failed:", {
        userId: req.user.id,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        error: err.message,
        code: err.code,
        name: err.name
      });
      throw err;
    }

    const profile = await updateProfilePhotoByRole({
      userId: req.user.id,
      role: req.user.role,
      profilePhotoUrl: uploaded.url
    });

    res.json({ message: "Avatar uploaded", profile, avatarUrl: uploaded.url });
  });
};
