import { z } from "zod";

export const CREATIVE_TYPES = ["photographer", "videographer", "content_creator"];

export const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  // "photographer" is the umbrella creative role; the specific creative
  // subtypes (one or more) live in creativeTypes below.
  role: z.enum(["client", "photographer"]).optional().default("client"),
  creativeTypes: z.array(z.enum(CREATIVE_TYPES)).min(1).max(3).optional()
}).refine(
  (data) => data.role === "client" || data.creativeTypes?.length,
  {
    message: "creativeTypes is required when signing up as a photographer",
    path: ["creativeTypes"]
  }
);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4)
});

export const resendVerificationSchema = z.object({
  email: z.string().email()
});

export const requestResetSchema = z.object({
  email: z.string().email()
});

export const confirmResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  newPassword: z.string().min(8)
});

export const updateRoleSchema = z.object({
  role: z.enum(["client", "photographer"])
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(30).optional()
}).refine((value) => value.name !== undefined || value.email !== undefined || value.phone !== undefined, {
  message: "At least one field is required"
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmNewPassword: z.string().min(1, "Please confirm your new password")
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New password and confirm password do not match",
  path: ["confirmNewPassword"]
});
