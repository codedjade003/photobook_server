import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { findUserById } from "../repositories/user.repo.js";
import { isParticipant } from "../repositories/conversation.repo.js";
import { sendTextMessage } from "../services/messaging.service.js";
import { createSocketRateLimiter } from "../utils/socketRateLimit.js";
import { isTruthyEnv } from "../utils/env.js";

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
  const io = new Server(server, {
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

        const message = await sendTextMessage({ conversationId, senderId: userId, content });
        io.to(conversationId).emit("message", message);
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

        socket.to(conversationId).emit("webrtc_offer", {
          conversationId,
          fromUserId: userId,
          offer
        });

        return respond(ack, { ok: true });
      } catch (err) {
        console.error("webrtc_offer failed:", err.message);
        return respond(ack, { ok: false, error: "server_error" });
      }
    });

    socket.on("webrtc_answer", async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        const answer = payload?.answer;

        if (!conversationId || !isUuid(conversationId) || !answer) {
          return respond(ack, { ok: false, error: "invalid_payload" });
        }

        const limitCheck = await signalLimiter.consume({ userId, event: "webrtc_answer" });
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

        socket.to(conversationId).emit("webrtc_answer", {
          conversationId,
          fromUserId: userId,
          answer
        });

        return respond(ack, { ok: true });
      } catch (err) {
        console.error("webrtc_answer failed:", err.message);
        return respond(ack, { ok: false, error: "server_error" });
      }
    });

    socket.on("ice_candidate", async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        const candidate = payload?.candidate;

        if (!conversationId || !isUuid(conversationId) || !candidate) {
          return respond(ack, { ok: false, error: "invalid_payload" });
        }

        const limitCheck = await signalLimiter.consume({ userId, event: "ice_candidate" });
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

        socket.to(conversationId).emit("ice_candidate", {
          conversationId,
          fromUserId: userId,
          candidate
        });

        return respond(ack, { ok: true });
      } catch (err) {
        console.error("ice_candidate failed:", err.message);
        return respond(ack, { ok: false, error: "server_error" });
      }
    });
  });

  return io;
};
