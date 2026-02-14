import { addRateCardItem, listRateCardItems } from "../repositories/rateCard.repo.js";
import { createRateCardItemSchema } from "../validators/rateCard.schema.js";
import { handleRequest } from "../utils/http.js";

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
