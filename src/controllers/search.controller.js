import {
  findSimilarPhotographers,
  findSimilarPortfolioItems,
  getTrendingTags,
  searchPortfolio,
  searchUsers
} from "../repositories/search.repo.js";
import { handleRequest } from "../utils/http.js";

const parseIntInRange = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const parseNumberInRange = (value, fallback, min, max) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const parseBoolean = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const lowered = String(value).toLowerCase();
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  return fallback;
};

const parseTags = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
};

export const discoverUsersController = (req, res) => {
  return handleRequest(res, async () => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const role = typeof req.query.role === "string" ? req.query.role : "photographer";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "relevance";
    const limit = parseIntInRange(req.query.limit, 20, 1, 100);
    const offset = parseIntInRange(req.query.offset, 0, 0, 100000);
    const minRating = parseNumberInRange(req.query.minRating, null, 0, 5);
    const minReviews = parseIntInRange(req.query.minReviews, null, 0, 100000);
    const location = typeof req.query.location === "string" ? req.query.location.trim() : "";
    const tags = parseTags(req.query.tags);
    const matchAllTags = parseBoolean(req.query.matchAllTags, false);
    const hasPortfolio = parseBoolean(req.query.hasPortfolio, null);

    if (!["photographer", "client", "all"].includes(role)) {
      throw new Error("Invalid role filter");
    }
    if (!["recent", "rating", "reviews", "relevance", "trending"].includes(sort)) {
      throw new Error("Invalid sort option");
    }

    const appliedRole = role === "all" ? null : role;
    const { items, total } = await searchUsers({
      q,
      role: appliedRole,
      limit,
      offset,
      sort,
      minRating,
      minReviews,
      location,
      tags,
      matchAllTags,
      hasPortfolio
    });

    res.json({
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total
      },
      filters: {
        q,
        role,
        sort,
        minRating,
        minReviews,
        location,
        tags,
        matchAllTags,
        hasPortfolio
      }
    });
  });
};

export const searchPortfolioController = (req, res) => {
  return handleRequest(res, async () => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const mediaType = typeof req.query.mediaType === "string" ? req.query.mediaType : null;
    const photographerId = typeof req.query.photographerId === "string" ? req.query.photographerId : null;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "relevance";
    const tags = parseTags(req.query.tags);
    const limit = parseIntInRange(req.query.limit, 20, 1, 100);
    const offset = parseIntInRange(req.query.offset, 0, 0, 100000);

    if (mediaType && !["image", "video"].includes(mediaType)) {
      throw new Error("Invalid mediaType filter");
    }
    if (!["recent", "popular", "relevance"].includes(sort)) {
      throw new Error("Invalid sort option");
    }

    const { items, total } = await searchPortfolio({
      q,
      mediaType,
      tags,
      photographerId,
      limit,
      offset,
      sort
    });

    res.json({
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total
      },
      filters: {
        q,
        mediaType,
        tags,
        photographerId,
        sort
      }
    });
  });
};

export const similarPhotographersController = (req, res) => {
  return handleRequest(res, async () => {
    const limit = parseIntInRange(req.query.limit, 12, 1, 50);
    const offset = parseIntInRange(req.query.offset, 0, 0, 100000);

    const { items, total } = await findSimilarPhotographers({
      userId: req.params.userId,
      limit,
      offset
    });

    res.json({
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total
      }
    });
  });
};

export const similarPortfolioItemsController = (req, res) => {
  return handleRequest(res, async () => {
    const limit = parseIntInRange(req.query.limit, 12, 1, 50);
    const offset = parseIntInRange(req.query.offset, 0, 0, 100000);

    const { items, total } = await findSimilarPortfolioItems({
      itemId: req.params.itemId,
      limit,
      offset
    });

    res.json({
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total
      }
    });
  });
};

export const trendingTagsController = (req, res) => {
  return handleRequest(res, async () => {
    const limit = parseIntInRange(req.query.limit, 20, 1, 100);
    const tags = await getTrendingTags(limit);
    res.json({ items: tags });
  });
};
