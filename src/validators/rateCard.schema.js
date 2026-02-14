import { z } from "zod";

export const createRateCardItemSchema = z.object({
  serviceName: z.string().min(2).max(120),
  quantityLabel: z.string().max(60).optional(),
  quantityMax: z.number().int().positive().optional(),
  pricingMode: z.enum(["fixed", "contact"]),
  pricingAmount: z.number().nonnegative().optional(),
  currencyCode: z.string().length(3).optional(),
  sortOrder: z.number().int().nonnegative().optional()
}).superRefine((value, ctx) => {
  if (value.pricingMode === "fixed" && value.pricingAmount === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pricingAmount"],
      message: "pricingAmount is required when pricingMode is fixed"
    });
  }
});
