import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

const creativeTypeEnum = z.enum(["photographer", "videographer", "content_creator"]);
const indoorOutdoor = z.enum(["indoor", "outdoor"]);

const baseSessionFields = {
  photographerId: z.string().uuid(),
  // Which subtype the client is hiring the creative as.
  creativeType: creativeTypeEnum,
  eventTypeId: z.number().int().positive(),
  // Package — selected from the creative's rate card. Price is read
  // server-side from the rate card item (never from the frontend).
  rateCardItemId: z.string().uuid(),
  sessionDate: z.string().regex(dateRegex),
  sessionTime: z.string().regex(timeRegex),
  sessionEndTime: z.string().regex(timeRegex).optional(),
  locationText: z.string().min(3).max(400),
  useCreativeStudio: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().default("")
};

export const photographerBookingSchema = z.object({
  ...baseSessionFields,
  locationType: indoorOutdoor,
  numberOfOutfits: z.number().int().nonnegative().optional()
});

export const videographerBookingSchema = z.object({
  ...baseSessionFields,
  locationType: indoorOutdoor,
  numberOfShootingLocations: z.number().int().positive().optional(),
  deliverableType: z.enum(["Highlight Video", "Full Coverage", "Social Media Reel", "Documentary"]),
  estimatedDurationMinutes: z.number().int().positive().optional()
});

export const contentCreatorBookingSchema = z.object({
  ...baseSessionFields,
  locationType: z.enum(["indoor", "outdoor", "remote"]),
  numberOfOutfits: z.number().int().nonnegative().optional()
});

// Legacy export for backward compatibility
export const createSessionSchema = photographerBookingSchema;
