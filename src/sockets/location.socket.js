import { canViewLocation } from "../repositories/location.repo.js";
import { upsertLocation } from "../repositories/location.repo.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === "string" && UUID_REGEX.test(value);

const respond = (ack, payload) => {
  if (typeof ack === "function") {
    ack(payload);
  }
};

/**
 * Attach location-related socket events to the existing Socket.io instance.
 * Call this after the HTTP server and io are initialized.
 */
export const initLocationSockets = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.data.user?.id;

    /**
     * Subscribe to a user's live location updates.
     * Server emits "location:moved" when that user updates their location.
     */
    socket.on("location:subscribe", async (payload, ack) => {
      try {
        const targetUserId = payload?.targetUserId;
        if (!targetUserId || !isUuid(targetUserId)) {
          return respond(ack, { ok: false, error: "invalid_payload" });
        }

        const allowed = await canViewLocation({ viewerId: userId, targetUserId });
        if (!allowed) {
          return respond(ack, { ok: false, error: "forbidden" });
        }

        socket.join(`location:${targetUserId}`);
        return respond(ack, { ok: true, targetUserId });
      } catch (err) {
        console.error("location:subscribe failed:", err.message);
        return respond(ack, { ok: false, error: "server_error" });
      }
    });

    /**
     * Unsubscribe from a user's location updates.
     */
    socket.on("location:unsubscribe", (payload, ack) => {
      const targetUserId = payload?.targetUserId;
      if (targetUserId) {
        socket.leave(`location:${targetUserId}`);
      }
      return respond(ack, { ok: true });
    });

    /**
     * Update your own location and broadcast to all subscribers.
     */
    socket.on("location:update", async (payload, ack) => {
      try {
        const { latitude, longitude, accuracy, altitude, speed, heading } = payload || {};
        if (typeof latitude !== "number" || typeof longitude !== "number") {
          return respond(ack, { ok: false, error: "invalid_payload" });
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          return respond(ack, { ok: false, error: "coordinates_out_of_range" });
        }

        const location = await upsertLocation({
          userId,
          latitude,
          longitude,
          accuracy,
          altitude,
          speed,
          heading
        });

        const updatePayload = {
          userId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude,
          speed: location.speed,
          heading: location.heading,
          updatedAt: location.updated_at
        };

        io.to(`location:${userId}`).emit("location:moved", updatePayload);

        return respond(ack, { ok: true, location: updatePayload });
      } catch (err) {
        console.error("location:update failed:", err.message);
        return respond(ack, { ok: false, error: "server_error" });
      }
    });
  });
};
