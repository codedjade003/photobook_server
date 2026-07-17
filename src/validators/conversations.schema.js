import { z } from "zod";

const pickFirst = (value) => Array.isArray(value) ? value[0] : value;

const parseLimit = (value) => {
  const raw = pickFirst(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBoolean = (value) => {
  const raw = pickFirst(value);
  if (raw === undefined) return undefined;
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  return undefined;
};

export const createConversationSchema = z.object({
  type: z.enum(["direct", "group"]).default("direct"),
  title: z.string().min(1).max(120).optional(),
  participantIds: z.array(z.string().uuid()).min(1).max(50),
  initialMessage: z.string().min(1).max(2000).optional()
});

export const conversationIdSchema = z.string().uuid();

export const conversationIdParamsSchema = z.object({
  id: conversationIdSchema
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000)
});

export const listMessagesSchema = z.object({
  limit: z.preprocess(parseLimit, z.number().int().min(1).max(50)).optional(),
  cursor: z.string().optional(),
  markRead: z.preprocess(parseBoolean, z.boolean()).optional()
});
