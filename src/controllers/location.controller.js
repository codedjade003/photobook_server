import { updateLocationSchema, addShareSchema } from "../validators/location.schema.js";
import {
  updateMyLocation,
  getMyLocation,
  getUserLocation,
  getVisibleLocations,
  shareWithUser,
  stopSharingWithUser,
  getMyShares
} from "../services/location.service.js";
import { handleRequest } from "../utils/http.js";

export const updateLocationController = (req, res) => {
  return handleRequest(res, async () => {
    const payload = updateLocationSchema.parse(req.body);
    const location = await updateMyLocation({ userId: req.user.id, payload });
    res.json({ message: "Location updated", location });
  });
};

export const getMyLocationController = (req, res) => {
  return handleRequest(res, async () => {
    const location = await getMyLocation(req.user.id);
    if (!location) return res.status(404).json({ message: "No location recorded yet" });
    res.json({ location });
  });
};

export const getNearbyLocationsController = (req, res) => {
  return handleRequest(res, async () => {
    const locations = await getVisibleLocations(req.user.id);
    res.json({ locations });
  });
};

export const getUserLocationController = (req, res) => {
  return handleRequest(res, async () => {
    const location = await getUserLocation({
      viewerId: req.user.id,
      targetUserId: req.params.userId
    });
    if (!location) return res.status(404).json({ message: "No location recorded yet" });
    res.json({ location });
  });
};

export const shareLocationController = (req, res) => {
  return handleRequest(res, async () => {
    const payload = addShareSchema.parse(req.body);
    const share = await shareWithUser({ userId: req.user.id, targetUserId: payload.targetUserId });
    res.status(201).json({ message: "Location shared", share });
  });
};

export const unshareLocationController = (req, res) => {
  return handleRequest(res, async () => {
    const removed = await stopSharingWithUser({ userId: req.user.id, targetUserId: req.params.userId });
    res.json({ message: "Location sharing stopped", share: removed });
  });
};

export const listSharesController = (req, res) => {
  return handleRequest(res, async () => {
    const shares = await getMyShares(req.user.id);
    res.json(shares);
  });
};
