import { handleRequest } from "../utils/http.js";
import {
  createSessionReview,
  listProfileReviews
} from "../services/review.service.js";

export const createReviewController = (req, res) => {
  return handleRequest(res, async () => {
    const { rating, comment } = req.body;

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: "rating must be an integer between 1 and 5" });
    }

    const review = await createSessionReview({
      userId: req.user.id,
      sessionId: req.params.id,
      rating: parsedRating,
      comment: typeof comment === "string" ? comment : undefined
    });

    res.status(201).json({ message: "Review submitted", review });
  });
};

export const listProfileReviewsController = (req, res) => {
  return handleRequest(res, async () => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const reviews = await listProfileReviews({ profileId: req.params.id, limit });
    res.json({ reviews });
  });
};
