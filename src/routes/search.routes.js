import { Router } from "express";
import {
	discoverUsersController,
	searchPortfolioController,
	similarPhotographersController,
	similarPortfolioItemsController,
	trendingTagsController
} from "../controllers/search.controller.js";

const router = Router();

/**
 * @swagger
 * /api/search/users:
 *   get:
 *     summary: Discover users for feed and directory views
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Free-text search over user name, business name, display title, and tags.
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [photographer, client, all]
 *         description: Role filter; defaults to photographer.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, rating, reviews, relevance, trending]
 *         description: Sort by recency, rating, review volume, weighted relevance, or trending score.
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *       - in: query
 *         name: minReviews
 *         schema:
 *           type: integer
 *           minimum: 0
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags.
 *       - in: query
 *         name: matchAllTags
 *         schema:
 *           type: boolean
 *         description: If true, all provided tags must match.
 *       - in: query
 *         name: hasPortfolio
 *         schema:
 *           type: boolean
 *         description: Restrict results to users with portfolio media.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Page size, default 20.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Pagination offset, default 0.
 *     responses:
 *       200:
 *         description: Search results returned
 */
router.get("/users", discoverUsersController);

/**
 * @swagger
 * /api/search/photographers:
 *   get:
 *     summary: Discover photographers (alias for /api/search/users?role=photographer)
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, rating]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Photographer search results returned
 */
router.get("/photographers", (req, _res, next) => {
  req.query.role = "photographer";
  next();
}, discoverUsersController);

/**
 * @swagger
 * /api/search/users/{userId}/similar:
 *   get:
 *     summary: Find photographers similar to a user/profile
 *     tags: [Search]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Similar photographers returned
 */
router.get("/users/:userId/similar", similarPhotographersController);

/**
 * @swagger
 * /api/search/portfolio:
 *   get:
 *     summary: Search portfolio media across title, description, and tags
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: mediaType
 *         schema:
 *           type: string
 *           enum: [image, video]
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags.
 *       - in: query
 *         name: photographerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, popular, relevance]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Portfolio search results returned
 */
router.get("/portfolio", searchPortfolioController);

/**
 * @swagger
 * /api/search/portfolio/{itemId}/similar:
 *   get:
 *     summary: Find similar portfolio media by tag/text similarity score
 *     tags: [Search]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Similar portfolio items returned
 */
router.get("/portfolio/:itemId/similar", similarPortfolioItemsController);

/**
 * @swagger
 * /api/search/tags/trending:
 *   get:
 *     summary: Get trending portfolio tags for quick suggestions/autocomplete
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Trending tags returned
 */
router.get("/tags/trending", trendingTagsController);

export default router;
