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
  updateRoleForUser,
  generateTwoFASetup,
  enableUserTwoFA,
  disableUserTwoFA,
  verifyUserTwoFAToken,
  findOrCreateOAuthUser
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

// ==================== 2FA Controllers ====================

export const setupTwoFA = (req, res) => {
  return handleRequest(res, async () => {
    const twoFAData = await generateTwoFASetup(req.user.id);
    res.json({
      message: "2FA setup initiated",
      secret: twoFAData.secret,
      qrCodeUrl: twoFAData.qrCodeUrl,
      backupCodes: twoFAData.backupCodes
    });
  });
};

export const confirmTwoFA = (req, res) => {
  return handleRequest(res, async () => {
    const { token, secret, backupCodes } = req.body;
    if (!token || !secret || !Array.isArray(backupCodes)) {
      return res.status(400).json({ message: "Missing required fields: token, secret, backupCodes" });
    }

    const { user, message } = await enableUserTwoFA({
      userId: req.user.id,
      token,
      secret,
      backupCodes
    });

    res.json({ message, user: sanitizeUser(user) });
  });
};

export const disableTwoFA = (req, res) => {
  return handleRequest(res, async () => {
    const { user, message } = await disableUserTwoFA(req.user.id);
    res.json({ message, user: sanitizeUser(user) });
  });
};

export const verifyTwoFACode = (req, res) => {
  return handleRequest(res, async () => {
    const { token, backupCode } = req.body;
    if (!token && !backupCode) {
      return res.status(400).json({ message: "Either token or backupCode is required" });
    }

    const result = await verifyUserTwoFAToken(req.user.id, token, backupCode);
    res.json({ message: "2FA code verified", ...result });
  });
};

// ==================== Google OAuth Controllers ====================

export const googleOAuthCallback = (req, res) => {
  return handleRequest(res, async () => {
    if (!req.user) {
      return res.status(401).json({ message: "Google authentication failed" });
    }

    const { user, token } = await findOrCreateOAuthUser(req.user);
    
    // Redirect to frontend with token (you can also send this as JSON)
    const redirectUrl = `${process.env.WEB_BASE_URL}/auth/callback?token=${token}&userId=${user.id}`;
    res.redirect(redirectUrl);
  });
};

export const googleOAuthCallbackJSON = (req, res) => {
  return handleRequest(res, async () => {
    if (!req.user) {
      return res.status(401).json({ message: "Google authentication failed" });
    }

    const { user, token } = await findOrCreateOAuthUser(req.user);
    res.json({ token, user: sanitizeUser(user), message: "Google authentication successful" });
  });
};
