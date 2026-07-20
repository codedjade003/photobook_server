import { z } from "zod";

const ALLOWED_CATEGORIES = [
  "weddings", "birthdays", "products", "headshots",
  "events", "editorial", "corporate", "lifestyle"
];

export const createOfferSchema = z.object({
  sentTo: z.string().uuid(),
  serviceName: z.string().min(2).max(120),
  pricingAmount: z.number().nonnegative(),
  pricingMode: z.enum(["fixed", "contact"]).optional().default("fixed"),
  currencyCode: z.string().length(3).optional().default("NGN"),
  description: z.string().max(1000).optional(),
  categories: z.array(z.enum(ALLOWED_CATEGORIES)).max(5).optional().default([]),
  whatsIncluded: z.array(z.string().min(1).max(100)).max(30).optional().default([]),
  deliveryTime: z.string().max(200).optional(),
  quantityLabel: z.string().max(60).optional(),
  quantityMax: z.number().int().positive().optional(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sessionTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  locationType: z.enum(["indoor", "outdoor"]).optional(),
  locationText: z.string().max(400).optional()
});
