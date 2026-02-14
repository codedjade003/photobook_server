import {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  requestResetSchema,
  confirmResetSchema,
  updateRoleSchema
} from "../validators/auth.schema.js";
import {
  signupUser,
  loginUser,
  verifyEmailCode,
  requestPasswordResetCode,
  confirmPasswordResetCode,
  updateRoleForUser
} from "../services/auth.service.js";
import { findUserById } from "../repositories/user.repo.js";
import { handleRequest, sanitizeUser } from "../utils/http.js";

export const signup = (req, res) => {
  return handleRequest(res, async () => {
    const payload = signupSchema.parse(req.body);
    const { user, token } = await signupUser(payload);
    res.status(201).json({
      message: "Signup successful.",
      token,
      user: sanitizeUser(user)
    });
  });
};

export const login = (req, res) => {
  return handleRequest(res, async () => {
    const payload = loginSchema.parse(req.body);
    const { user, token } = await loginUser(payload);
    res.json({ token, user: sanitizeUser(user) });
  });
};

export const verifyEmail = (req, res) => {
  return handleRequest(res, async () => {
    const payload = verifyEmailSchema.parse(req.body);
    const { user, token } = await verifyEmailCode(payload);
    res.json({ message: "Email verified", token, user: sanitizeUser(user) });
  });
};

export const requestPasswordReset = (req, res) => {
  return handleRequest(res, async () => {
    const payload = requestResetSchema.parse(req.body);
    const result = await requestPasswordResetCode(payload);
    const response = { message: "Reset code generated" };
    if (process.env.EMAIL_FEATURE_ENABLED !== "true") {
      response.resetCode = result.code;
    }
    res.json(response);
  });
};

export const confirmPasswordReset = (req, res) => {
  return handleRequest(res, async () => {
    const payload = confirmResetSchema.parse(req.body);
    const { user, token } = await confirmPasswordResetCode(payload);
    res.json({ message: "Password reset successful", token, user: sanitizeUser(user) });
  });
};

export const updateRole = (req, res) => {
  return handleRequest(res, async () => {
    const payload = updateRoleSchema.parse(req.body);
    const { user, token } = await updateRoleForUser({
      userId: req.user.id,
      role: payload.role
    });
    res.json({ message: "Role updated", token, user: sanitizeUser(user) });
  });
};

export const me = (req, res) => {
  return handleRequest(res, async () => {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: sanitizeUser(user) });
  });
};
