import { z } from "zod";

const ALLOWED_CATEGORIES = [
  "weddings", "birthdays", "products", "headshots",
  "events", "editorial", "corporate", "lifestyle"
];

export const createRateCardItemSchema = z.object({
  serviceName: z.string().min(2).max(120),
  pricingAmount: z.number().nonnegative(),
  pricingMode: z.enum(["fixed", "contact"]).optional().default("fixed"),
  quantityLabel: z.string().max(60).optional(),
  quantityMax: z.number().int().positive().optional(),
  currencyCode: z.string().length(3).optional().default("NGN"),
  sortOrder: z.number().int().nonnegative().optional().default(0),
  categories: z.array(z.enum(ALLOWED_CATEGORIES)).max(5).optional().default([]),
  description: z.string().max(1000).optional(),
  whatsIncluded: z.array(z.string().min(1).max(100)).max(30).optional().default([]),
  deliveryTime: z.string().max(200).optional()
});

export const updateRateCardItemSchema = z.object({
  serviceName: z.string().min(2).max(120).optional(),
  pricingAmount: z.number().nonnegative().optional(),
  pricingMode: z.enum(["fixed", "contact"]).optional(),
  quantityLabel: z.string().max(60).optional(),
  quantityMax: z.number().int().positive().optional(),
  currencyCode: z.string().length(3).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  categories: z.array(z.enum(ALLOWED_CATEGORIES)).max(5).optional(),
  description: z.string().max(1000).optional(),
  whatsIncluded: z.array(z.string().min(1).max(100)).max(30).optional(),
  deliveryTime: z.string().max(200).optional()
}).refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  { message: "At least one field is required" }
);
