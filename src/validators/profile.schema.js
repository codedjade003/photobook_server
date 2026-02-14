import { z } from "zod";

export const photographerProfileSchema = z.object({
  businessName: z.string().min(2).max(120).optional(),
  profilePhotoUrl: z.string().url().optional(),
  displayTitle: z.string().max(120).optional(),
  about: z.string().max(500).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional()
});

export const clientProfileSchema = z.object({
  profilePhotoUrl: z.string().url().optional(),
  location: z.string().max(160).optional()
});
