import { z } from "zod";

export const createPortfolioItemSchema = z.object({
  mediaType: z.enum(["image", "video"]),
  storageKey: z.string().min(3),
  mediaUrl: z.string().url(),
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  fileSizeBytes: z.number().int().positive(),
  durationSeconds: z.number().int().positive().max(60).optional(),
  isCover: z.boolean().optional().default(false)
}).superRefine((value, ctx) => {
  if (value.mediaType === "video" && !value.durationSeconds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["durationSeconds"],
      message: "durationSeconds is required for video"
    });
  }
});
