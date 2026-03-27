export const sanitizeUser = (user) => {
  if (!user) return user;
  const safe = { ...user };
  delete safe.password_hash;
  delete safe.verification_code;
  delete safe.verification_code_expires_at;
  delete safe.verification_attempt_count;
  delete safe.verification_last_attempt_at;
  delete safe.verification_locked_until;
  delete safe.verification_resend_count;
  delete safe.verification_resend_window_started_at;
  delete safe.verification_last_sent_at;
  delete safe.reset_code;
  delete safe.reset_code_expires_at;
  return safe;
};

export const resolveErrorStatus = (message) => {
  if (message === "Invalid credentials") return 401;
  if (message === "User not found") return 404;
  if (message === "Email not verified") return 403;
  if (message === "File is required") return 400;
  if (message.includes("Unable to send verification code")) return 503;
  if (message.includes("Too many") || message.includes("Please wait") || message.includes("limit reached")) return 429;
  if (message.includes("Invalid file type")) return 400;
  if (message.includes("B2 not configured")) return 500;
  if (message.includes("Delete failed after storage removal")) return 500;
  if (message.includes("Media limit exceeded")) return 400;
  if (message.includes("exists")) return 409;
  if (message.includes("forbidden")) return 403;
  return 400;
};

export const handleRequest = (res, fn) => fn().catch((err) => {
  if (err?.name === "ZodError" && Array.isArray(err?.issues)) {
    const errors = err.issues.map((issue) => ({
      field: issue.path?.length ? issue.path.join(".") : "request",
      message: issue.message
    }));
    return res.status(400).json({ message: "Validation error", errors });
  }

  const message = err.message || "Unexpected error";
  if (process.env.NODE_ENV !== "test") {
    console.error("Request error:", message);
  }
  res.status(resolveErrorStatus(message)).json({ message });
});
