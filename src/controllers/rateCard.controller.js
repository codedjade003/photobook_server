import {
  addRateCardItem,
  deleteRateCardItemById,
  findRateCardItemById,
  listRateCardItems
} from "../repositories/rateCard.repo.js";
import { createRateCardItemSchema } from "../validators/rateCard.schema.js";
import { handleRequest } from "../utils/http.js";
import { hasDevOverridePassword } from "../utils/devAccess.js";

export const createRateCardItemController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "photographer") throw new Error("forbidden");
    const payload = createRateCardItemSchema.parse(req.body);
    const item = await addRateCardItem({ photographerId: req.user.id, payload });
    res.status(201).json({ message: "Rate card item created", item });
  });
};

export const getMyRateCardController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "photographer") throw new Error("forbidden");
    const items = await listRateCardItems(req.user.id);
    res.json({ items });
  });
};

export const getPhotographerRateCardController = (req, res) => {
  return handleRequest(res, async () => {
    const items = await listRateCardItems(req.params.photographerId);
    res.json({ items });
  });
};

export const deleteRateCardItemController = (req, res) => {
  return handleRequest(res, async () => {
    const item = await findRateCardItemById(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Rate card item not found" });

    const isDevOverride = await hasDevOverridePassword(req);
    const isOwner = req.user && req.user.id === item.photographer_id;
    if (!isOwner && !isDevOverride) throw new Error("forbidden");

    const deleted = await deleteRateCardItemById(req.params.itemId);
    res.json({ message: "Rate card item deleted", item: deleted });
  });
};
