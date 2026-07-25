import { z } from "zod";

const packageTypeEnum = z.enum(["basic", "standard", "premium"]);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
const locationTypeEnum = z.enum(["indoor", "outdoor"]);

const baseSessionFields = {
  photographerId: z.string().uuid(),
  eventTypeId: z.number().int().positive(),
  packageType: packageTypeEnum,
  sessionDate: z.string().regex(dateRegex),
  locationType: locationTypeEnum,
  locationText: z.string().min(5).max(400),
  notes: z.string().max(1000).optional().default("")
};

export const photographerBookingSchema = z.object({
  ...baseSessionFields,
  sessionTime: z.string().regex(timeRegex),
  numberOfOutfits: z.number().int().nonnegative().optional()
});

export const videographerBookingSchema = z.object({
  ...baseSessionFields,
  estimatedDurationMinutes: z.number().int().positive(),
  numberOfShootingLocations: z.number().int().positive().optional(),
  deliverableType: z.enum(["Highlight Video", "Full Coverage", "Social Media Reel", "Documentary"]),
  sessionTime: z.string().regex(timeRegex).optional()
});

export const contentCreatorBookingSchema = z.object({
  ...baseSessionFields,
  sessionTime: z.string().regex(timeRegex),
  numberOfOutfits: z.number().int().nonnegative().optional()
});

// Legacy export for backward compatibility
export const createSessionSchema = photographerBookingSchema;
