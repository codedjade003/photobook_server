import { z } from "zod";

export const createSessionSchema = z.object({
  photographerId: z.string().uuid(),
  eventTypeId: z.number().int().positive(),
  packageType: z.enum(["regular", "premium"]),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  locationType: z.enum(["indoor", "outdoor"]),
  locationText: z.string().min(5).max(400)
});
