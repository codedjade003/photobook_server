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
