import {
  createNotification,
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead
} from "../services/notification.service.js";
import {
  registerDeviceTokenForUser,
  unregisterDeviceToken
} from "../services/push.service.js";
import { handleRequest } from "../utils/http.js";

export const listNotifications = (req, res) => {
  return handleRequest(res, async () => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unread === "true";

    const result = await getNotifications({
      userId: req.user.id,
      limit,
      offset,
      unreadOnly
    });

    res.json(result);
  });
};

export const markRead = (req, res) => {
  return handleRequest(res, async () => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "ids array is required" });
    }

    const marked = await markNotificationsRead({ userId: req.user.id, ids });
    res.json({ message: `${marked.length} notifications marked as read`, marked });
  });
};

export const markAllRead = (req, res) => {
  return handleRequest(res, async () => {
    const result = await markAllNotificationsRead(req.user.id);
    res.json({ message: `${result.count} notifications marked as read` });
  });
};

export const registerDeviceToken = (req, res) => {
  return handleRequest(res, async () => {
    const { token, platform } = req.body;
    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ message: "token is required" });
    }

    const saved = await registerDeviceTokenForUser({
      userId: req.user.id,
      token: token.trim(),
      platform: typeof platform === "string" ? platform : undefined
    });

    res.status(201).json({ message: "Device token registered", deviceToken: saved });
  });
};

export const deleteDeviceToken = (req, res) => {
  return handleRequest(res, async () => {
    const { token } = req.body;
    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ message: "token is required" });
    }

    await unregisterDeviceToken({ userId: req.user.id, token: token.trim() });
    res.json({ message: "Device token removed" });
  });
};

// Helper to trigger notifications from other controllers
export const notify = {
  bookingConfirmed: async ({ clientId, photographerId, session }) => {
    await Promise.all([
      createNotification({
        userId: clientId,
        type: "booking_confirmed",
        title: "Booking Confirmed",
        body: `Your session has been booked on ${session.session_date}.`,
        data: { sessionId: session.id }
      }),
      createNotification({
        userId: photographerId,
        type: "booking_confirmed",
        title: "New Booking",
        body: "A client has booked a session with you.",
        data: { sessionId: session.id }
      })
    ]);
  },

  bookingCanceled: async ({ clientId, photographerId, session }) => {
    await Promise.all([
      createNotification({
        userId: photographerId,
        type: "booking_canceled",
        title: "Booking Canceled",
        body: "A session has been canceled.",
        data: { sessionId: session.id }
      }),
      createNotification({
        userId: clientId,
        type: "booking_canceled",
        title: "Booking Canceled",
        body: "Your session has been canceled.",
        data: { sessionId: session.id }
      })
    ]);
  },

  offerReceived: async ({ userId, offer }) => {
    await createNotification({
      userId,
      type: "offer_received",
      title: "New Offer Received",
      body: `You received an offer for "${offer.service_name}".`,
      data: { offerId: offer.id }
    });
  },

  offerUpdated: async ({ userId, offer }) => {
    await createNotification({
      userId,
      type: "offer_updated",
      title: "Offer Updated",
      body: `An offer has been updated.`,
      data: { offerId: offer.id }
    });
  },

  newMessage: async ({ userId, conversationId, senderName }) => {
    await createNotification({
      userId,
      type: "new_message",
      title: "New Message",
      body: senderName ? `${senderName} sent you a message.` : "You have a new message.",
      data: { conversationId }
    });
  },

  paymentProcessed: async ({ userId, sessionId, amount }) => {
    await createNotification({
      userId,
      type: "payment_processed",
      title: "Payment Processed",
      body: amount
        ? `Payment of ${amount} has been processed.`
        : "Your payment has been processed.",
      data: { sessionId }
    });
  }
};
