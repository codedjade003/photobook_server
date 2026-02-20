import { deleteUserById, findUserById } from "../repositories/user.repo.js";
import { hasDevOverridePassword } from "../utils/devAccess.js";
import { handleRequest, sanitizeUser } from "../utils/http.js";

export const deleteUserController = (req, res) => {
  return handleRequest(res, async () => {
    const { userId } = req.params;
    const targetUser = await findUserById(userId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const isDevOverride = await hasDevOverridePassword(req);
    const isSelfDelete = req.user && req.user.id === userId;
    if (!isSelfDelete && !isDevOverride) throw new Error("forbidden");

    const deleted = await deleteUserById(userId);
    res.json({ message: "User deleted", user: sanitizeUser(deleted) });
  });
};

export const deleteMyUserController = (req, res) => {
  return handleRequest(res, async () => {
    const isDevOverride = await hasDevOverridePassword(req);
    if (!req.user && !isDevOverride) throw new Error("forbidden");

    const targetUserId = req.user?.id || req.body?.userId;
    if (!targetUserId) throw new Error("userId is required when using dev override without token");

    const targetUser = await findUserById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const deleted = await deleteUserById(targetUserId);
    res.json({ message: "User deleted", user: sanitizeUser(deleted) });
  });
};
