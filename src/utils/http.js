export const sanitizeUser = (user) => {
  if (!user) return user;
  const safe = { ...user };
  delete safe.password_hash;
  delete safe.verification_code;
  delete safe.verification_code_expires_at;
  delete safe.reset_code;
  delete safe.reset_code_expires_at;
  return safe;
};

export const resolveErrorStatus = (message) => {
  if (message === "Invalid credentials") return 401;
  if (message === "User not found") return 404;
  if (message === "Email not verified") return 403;
  if (message === "File is required") return 400;
  if (message.includes("Invalid file type")) return 400;
  if (message.includes("B2 not configured")) return 500;
  if (message.includes("Delete failed after storage removal")) return 500;
  if (message.includes("Media limit exceeded")) return 400;
  if (message.includes("exists")) return 409;
  if (message.includes("forbidden")) return 403;
  return 400;
};

export const handleRequest = (res, fn) => fn().catch((err) => {
  const message = err.message || "Unexpected error";
  res.status(resolveErrorStatus(message)).json({ message });
});
