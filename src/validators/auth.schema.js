import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  // We are standardizing on "photographer" (not "creative") for now.
  role: z.enum(["client", "photographer"]).optional().default("client")
});

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
