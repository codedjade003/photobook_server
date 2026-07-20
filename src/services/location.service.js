import {
  upsertLocation,
  getLocationByUserId,
  getLocationsForUser,
  addShare,
  removeShare,
  canViewLocation,
  listSharesGiven,
  listSharesReceived
} from "../repositories/location.repo.js";

export const updateMyLocation = async ({ userId, payload }) => {
  const location = await upsertLocation({ userId, ...payload });
  return location;
};

export const getMyLocation = async (userId) => {
  return getLocationByUserId(userId);
};

export const getUserLocation = async ({ viewerId, targetUserId }) => {
  const allowed = await canViewLocation({ viewerId, targetUserId });
  if (!allowed) {
    throw new Error("forbidden");
  }
  return getLocationByUserId(targetUserId);
};

export const getVisibleLocations = async (userId) => {
  return getLocationsForUser(userId);
};

export const shareWithUser = async ({ userId, targetUserId }) => {
  if (userId === targetUserId) {
    throw new Error("Cannot share location with yourself");
  }
  const share = await addShare({ userId, targetUserId });
  return share;
};

export const stopSharingWithUser = async ({ userId, targetUserId }) => {
  const removed = await removeShare({ userId, targetUserId });
  if (!removed) {
    throw new Error("Share relationship not found");
  }
  return removed;
};

export const getMyShares = async (userId) => {
  const given = await listSharesGiven(userId);
  const received = await listSharesReceived(userId);
  return { given, received };
};
