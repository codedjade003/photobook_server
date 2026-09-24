import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { findUserById } from "../repositories/user.repo.js";
import { isParticipant, listConversationParticipants } from "../repositories/conversation.repo.js";
import { sendTextMessage } from "../services/messaging.service.js";
import { sendPush } from "../services/push.service.js";
import { createSocketRateLimiter } from "../utils/socketRateLimit.js";
import { isTruthyEnv } from "../utils/env.js";
import { query } from "../config/db.js";

// Assigned in initMessagingSockets. It used to be shadowed there by a local
// `const io`, so this export stayed null and nothing outside the socket
// handlers could deliver anything in real time.
export let io = null;
export const onlineUsers = new Map(); // userId → Set<socketId>

/** Every socket joins its user's personal room when it connects. */
export const userRoom = (userId) => `user:${userId}`;

export const isUserOnline = (userId) => (onlineUsers.get(userId)?.size ?? 0) > 0;

/**
 * Where an event about a conversation should go: its room, plus the personal
 * room of every participant except [exceptUserId]. A conversation room only
 * holds sockets that asked to join it, so a brand-new conversation, or an
 * app that just reconnected, would otherwise hear nothing. socket.io
 * delivers once per socket however many of these rooms it is in.
 */
export const conversationAudience = async (conversationId, exceptUserId) => {
  const participants = await listConversationParticipants([conversationId]);
  return [
    conversationId,
    ...participants
      .filter((p) => p.user_id !== exceptUserId)
      .map((p) => userRoom(p.user_id))
  ];
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_MESSAGE_LENGTH = 2000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === "string" && UUID_REGEX.test(value);

const getSocketToken = (socket) => {
  const header = socket.handshake?.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === "string") {
    return authToken;
  }

  return null;
};

const respond = (ack, payload) => {
  if (typeof ack === "function") {
    ack(payload);
  }
};

export const initMessagingSockets = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.WEB_BASE_URL || "*",
      methods: ["GET", "POST"]
    }
  });

  const messageLimiter = createSocketRateLimiter({
    windowMs: parsePositiveInt(process.env.MESSAGE_RATE_LIMIT_WINDOW_MS, 10 * 1000),
    max: parsePositiveInt(process.env.MESSAGE_RATE_LIMIT_MAX, 10),
    keyPrefix: "ws:messages"
  });

  const signalLimiter = createSocketRateLimiter({
    windowMs: parsePositiveInt(process.env.SIGNAL_RATE_LIMIT_WINDOW_MS, 10 * 1000),
    max: parsePositiveInt(process.env.SIGNAL_RATE_LIMIT_MAX, 30),
    keyPrefix: "ws:signal"
  });

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await findUserById(decoded.id);
      if (!user) return next(new Error("Unauthorized"));

      if (isTruthyEnv(process.env.EMAIL_FEATURE_ENABLED) && !user.email_verified) {
        return next(new Error("Email not verified"));
      }

      socket.data.user = { id: user.id, role: user.role };
      return next();
    } catch (err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.user?.id;

    // ── Online presence ─────────────────────────────────
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Messages and calls for this user reach every device they're on, even
    // for conversations the app hasn't joined. (This used to broadcast
    // "online" to socket.rooms here — but a socket that has only just
    // connected isn't in any room yet, so that reached nobody. Presence is
    // announced from join_room instead.)
    socket.join(userRoom(userId));

    socket.on("join_room", async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId || !isUuid(conversationId)) {
          return respond(ack, { ok: false, error: "invalid_payload" });
        }

        const allowed = await isParticipant({ conversationId, userId });
        if (!allowed) {
          return respond(ack, { ok: false, error: "forbidden" });
        }

        socket.join(conversationId);

        // Tell the room this user is here, and tell this socket who else is.
        socket.to(conversationId).except(userRoom(userId)).emit("user:online", { userId });
        const participants = await listConversationParticipants([conversationId]);
        for (const p of participants) {
          if (p.user_id !== userId && isUserOnline(p.user_id)) {
            socket.emit("user:online", { userId: p.user_id });
          }
        }

        return respond(ack, { ok: true, conversationId });
      } catch (err) {
        console.error("join_room failed:", err.message);
        return respond(ack, { ok: false, error: "server_error" });
      }
    });

    socket.on("send_message", async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        const content = typeof payload?.content === "string" ? payload.content.trim() : "";
        if (!conversationId || !isUuid(conversationId) || !content) {
          return respond(ack, { ok: false, error: "invalid_payload" });
        }

        if (content.length > MAX_MESSAGE_LENGTH) {
          return respond(ack, { ok: false, error: "message_too_long" });
        }

        const limitCheck = await messageLimiter.consume({ userId, event: "send_message" });
        if (!limitCheck.allowed) {
          return respond(ack, {
            ok: false,
            error: "rate_limited",
            retryAfterSeconds: limitCheck.retryAfterSeconds
          });
        }

        // sendTextMessage delivers it — to the room and to every
        // participant's personal room — for socket and REST sends alike.
        const message = await sendTextMessage({ conversationId, senderId: userId, content });
        return respond(ack, { ok: true, message });
      } catch (err) {
        const error = err.message === "forbidden" ? "forbidden" : "send_failed";
        return respond(ack, { ok: false, error });
      }
    });

    socket.on("webrtc_offer", async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        const offer = payload?.offer;

        if (!conversationId || !isUuid(conversationId) || !offer) {
          return respond(ack, { ok: false, error: "invalid_payload" });
        }

        const limitCheck = await signalLimiter.consume({ userId, event: "webrtc_offer" });
        if (!limitCheck.allowed) {
          return respond(ack, {
            ok: false,
            error: "rate_limited",
            retryAfterSeconds: limitCheck.retryAfterSeconds
          });
        }

        const allowed = await isParticipant({ conversationId, userId });
        if (!allowed) {
          return respond(ack, { ok: false, error: "forbidden" });
        }

        const participants = await listConversationParticipants([conversationId]);
        const audience = [
          conversationId,
          ...participants.filter((p) => p.user_id !== userId).map((p) => userRoom(p.user_id))
        ];
        // .except keeps the caller's own other devices from ringing.
        socket.to(audience).except(userRoom(userId)).emit("webrtc_offer", {
          conversationId,
          fromUserId: userId,
          offer
        });

        // Push "incoming call" so the callee hears it even with the app
        // closed. The caller re-sends the offer while it rings (offer.repeat)
        // so an app opened from this push still receives it; only the first
        // one pushes.
        if (offer.repeat === true) return respond(ack, { ok: true });
        try {
          const caller = participants.find((p) => p.user_id === userId);
          for (const p of participants) {
            if (p.user_id !== userId) {
              sendPush(
                p.user_id,
                "Incoming Call",
                `${caller?.name || "Someone"} is calling you.`,
                { type: "incoming_call", conversationId }
              ).catch(() => {});
            }
          }
        } catch (err) {
          console.error("incoming call push failed:", err.message);
        }

        return respond(ack, { ok: true });
      } catch (err) {
        console.error("webrtc_offer failed:", err.message);
        return respond(ack, { ok: false, error: "server_error" });
      }
    });

    // Answer, ICE candidates, hang-up and decline all go to the other
    // participants' devices, not just the conversation room. call:end and
    // call:decline had no handler at all, so the other side only noticed a
    // hang-up when its connection timed out, or kept ringing for a minute.
    const relayCallSignal = (event, field) => async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        const value = field ? payload?.[field] : true;

        if (!conversationId || !isUuid(conversationId) || !value) {
          return respond(ack, { ok: false, error: "invalid_payload" });
        }

        const limitCheck = await signalLimiter.consume({ userId, event });
        if (!limitCheck.allowed) {
          return respond(ack, {
            ok: false,
            error: "rate_limited",
            retryAfterSeconds: limitCheck.retryAfterSeconds
          });
        }

        const allowed = await isParticipant({ conversationId, userId });
        if (!allowed) {
          return respond(ack, { ok: false, error: "forbidden" });
        }

        const audience = await conversationAudience(conversationId, userId);
        socket.to(audience).except(userRoom(userId)).emit(event, {
          conversationId,
          fromUserId: userId,
          ...(field ? { [field]: value } : {})
        });

        return respond(ack, { ok: true });
      } catch (err) {
        console.error(`${event} failed:`, err.message);
        return respond(ack, { ok: false, error: "server_error" });
      }
    };

    socket.on("webrtc_answer", relayCallSignal("webrtc_answer", "answer"));
    socket.on("ice_candidate", relayCallSignal("ice_candidate", "candidate"));
    socket.on("call:end", relayCallSignal("call:end"));
    socket.on("call:decline", relayCallSignal("call:decline"));

    // ── Typing indicators ───────────────────────────────
    socket.on("typing:start", async (payload) => {
      const conversationId = payload?.conversationId;
      if (!conversationId || !isUuid(conversationId)) return;
      const allowed = await isParticipant({ conversationId, userId });
      if (!allowed) return;
      socket.to(conversationId).emit("user:typing", { userId, conversationId });
    });

    socket.on("typing:stop", async (payload) => {
      const conversationId = payload?.conversationId;
      if (!conversationId || !isUuid(conversationId)) return;
      const allowed = await isParticipant({ conversationId, userId });
      if (!allowed) return;
      socket.to(conversationId).emit("user:stop_typing", { userId, conversationId });
    });

    // ── Going offline: broadcast + last seen ────────────
    // This must be "disconnecting": by "disconnect" socket.io has already
    // emptied socket.rooms, so the old offline broadcast reached nobody.
    socket.on("disconnecting", async () => {
      const rooms = [...socket.rooms].filter(
        (room) => room !== socket.id && room !== userRoom(userId)
      );

      const sockets = onlineUsers.get(userId);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size > 0) return; // still connected on another device
      onlineUsers.delete(userId);

      const lastSeenAt = new Date().toISOString();
      if (rooms.length) {
        socket.to(rooms).emit("user:offline", { userId, lastSeenAt });
      }

      try {
        await query("UPDATE users SET last_seen_at = NOW() WHERE id = $1", [userId]);
      } catch (err) {
        console.error("Failed to update last_seen_at:", err.message);
      }
    });
  });

  return io;
};
