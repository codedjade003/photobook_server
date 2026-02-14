import {
  addPortfolioItem,
  deletePortfolioItem,
  findPortfolioItemById,
  listMyPortfolio
} from "../repositories/portfolio.repo.js";
import { createPortfolioItemSchema } from "../validators/portfolio.schema.js";
import { handleRequest } from "../utils/http.js";
import { deleteObjectFromB2, uploadBufferToB2 } from "../config/b2.js";

const parseTags = (tagsInput) => {
  if (!tagsInput) return [];
  if (Array.isArray(tagsInput)) return tagsInput.map(String).filter(Boolean);
  if (typeof tagsInput !== "string") return [];

  const trimmed = tagsInput.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Fall through to comma-delimited parsing.
  }

  return trimmed.split(",").map((tag) => tag.trim()).filter(Boolean);
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
};

const parseDuration = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
};

export const createPortfolioItemController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "photographer") throw new Error("forbidden");
    const payload = createPortfolioItemSchema.parse(req.body);
    const item = await addPortfolioItem({ photographerId: req.user.id, payload });
    res.status(201).json({ message: "Portfolio item created", item });
  });
};

export const listMyPortfolioController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "photographer") throw new Error("forbidden");
    const items = await listMyPortfolio(req.user.id);
    res.json({ items });
  });
};

export const uploadPortfolioItemController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "photographer") throw new Error("forbidden");
    if (!req.file) throw new Error("File is required");

    const isVideo = req.file.mimetype.startsWith("video/");
    const maxVideoSeconds = Number(process.env.MAX_VIDEO_SECONDS || 60);
    const durationSeconds = parseDuration(req.body.durationSeconds);

    if (isVideo && durationSeconds === undefined) {
      throw new Error("durationSeconds is required for video uploads");
    }
    if (isVideo && durationSeconds > maxVideoSeconds) {
      throw new Error(`Video duration exceeds ${maxVideoSeconds} seconds`);
    }

    const uploaded = await uploadBufferToB2({
      userId: req.user.id,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    const payload = createPortfolioItemSchema.parse({
      mediaType: isVideo ? "video" : "image",
      storageKey: uploaded.key,
      mediaUrl: uploaded.url,
      title: req.body.title,
      description: req.body.description,
      tags: parseTags(req.body.tags),
      fileSizeBytes: req.file.size,
      durationSeconds,
      isCover: parseBoolean(req.body.isCover, false)
    });

    const item = await addPortfolioItem({ photographerId: req.user.id, payload });
    res.status(201).json({ message: "Portfolio uploaded", item });
  });
};

export const deletePortfolioItemController = (req, res) => {
  return handleRequest(res, async () => {
    if (req.user.role !== "photographer") throw new Error("forbidden");
    const existing = await findPortfolioItemById({ photographerId: req.user.id, itemId: req.params.itemId });
    if (!existing) return res.status(404).json({ message: "Portfolio item not found" });

    if (existing.storage_key) {
      await deleteObjectFromB2(existing.storage_key);
    }

    const deleted = await deletePortfolioItem({ photographerId: req.user.id, itemId: req.params.itemId });
    if (!deleted) {
      throw new Error("Delete failed after storage removal");
    }

    res.json({ message: "Portfolio item deleted from storage and database", item: deleted });
  });
};
