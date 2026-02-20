import bcrypt from "bcryptjs";

const getProvidedPassword = (req) => {
  const headerPassword = req.headers["x-dev-password"];
  if (typeof headerPassword === "string" && headerPassword.trim()) {
    return headerPassword.trim();
  }

  const bodyPassword = req.body?.devPassword;
  if (typeof bodyPassword === "string" && bodyPassword.trim()) {
    return bodyPassword.trim();
  }

  return null;
};

export const hasDevOverridePassword = async (req) => {
  const hash = process.env.DEV_OVERRIDE_PASSWORD_HASH;
  const provided = getProvidedPassword(req);
  if (!hash || !provided) return false;
  return bcrypt.compare(provided, hash);
};

export const assertDevOverridePassword = async (req) => {
  const ok = await hasDevOverridePassword(req);
  if (!ok) throw new Error("forbidden");
};
