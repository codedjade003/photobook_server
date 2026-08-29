import {
  createReview,
  findReviewBySessionId,
  listReviewsByPhotographer
} from "../repositories/review.repo.js";
import { findSessionById } from "../repositories/session.repo.js";
import { createNotification } from "./notification.service.js";
import { sendPush } from "./push.service.js";

export const createSessionReview = async ({ userId, sessionId, rating, comment }) => {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  // Only the client on the session can review the photographer.
  if (session.client_id !== userId) throw new Error("forbidden");

  // The session must be marked complete before a review is accepted.
  if (!session.completed_at) throw new Error("Session has not been completed yet");

  const existing = await findReviewBySessionId(sessionId);
  if (existing) throw new Error("Review already exists for this session");

  const review = await createReview({
    photographerId: session.photographer_id,
    clientId: userId,
    sessionId,
    rating,
    comment
  });

  // Notify the photographer (in-app + push).
  createNotification({
    userId: session.photographer_id,
    type: "new_review",
    title: "New Review",
    body: `You received a ${rating}-star review.`,
    data: { sessionId, reviewId: review.id }
  }).catch(() => {});

  sendPush(
    session.photographer_id,
    "New Review",
    `You received a ${rating}-star review.`
  ).catch(() => {});

  return review;
};

export const listProfileReviews = async ({ profileId, limit = 50 }) => {
  const rows = await listReviewsByPhotographer({ photographerId: profileId, limit });
  return rows.map((r) => ({
    id: r.id,
    photographerId: r.photographer_id,
    clientId: r.client_id,
    clientName: r.client_name || "Anonymous",
    sessionId: r.session_id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at
  }));
};
