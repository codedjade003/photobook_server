const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const buildShell = ({ preheader, title, intro, label, code, expiryMinutes, footer }) => {
  const safeCode = escapeHtml(code);
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                <h2 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#111827;">${escapeHtml(title)}</h2>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
                <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">${escapeHtml(label)}</p>
                <div style="margin:18px 0;padding:16px;border-radius:10px;background:#f3f4f6;text-align:center;">
                  <span style="font-size:28px;letter-spacing:4px;font-weight:700;color:#111827;">${safeCode}</span>
                </div>
                <p style="margin:0 0 12px;font-size:13px;color:#4b5563;">This code expires in ${escapeHtml(expiryMinutes)} minutes.</p>
                <p style="margin:0;font-size:13px;color:#4b5563;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
};

export const buildVerificationEmail = ({ code, expiryMinutes }) => {
  const subject = "Verify your email";
  const text = [
    "Thanks for signing up to Photobook.",
    `Your verification code is: ${code}`,
    `This code expires in ${expiryMinutes} minutes.`
  ].join("\n");

  const html = buildShell({
    preheader: "Verify your email for Photobook",
    title: "Verify Your Email",
    intro: "Thanks for signing up to Photobook. Please verify your email to complete your registration.",
    label: "Your verification code is:",
    code,
    expiryMinutes,
    footer: "If you did not sign up, you can ignore this email."
  });

  return { subject, text, html };
};

export const buildPasswordResetEmail = ({ code, expiryMinutes }) => {
  const subject = "Password reset code";
  const text = [
    "We received a request to reset your Photobook password.",
    `Your password reset code is: ${code}`,
    `This code expires in ${expiryMinutes} minutes.`
  ].join("\n");

  const html = buildShell({
    preheader: "Reset your Photobook password",
    title: "Reset Your Password",
    intro: "We received a request to reset your Photobook password.",
    label: "Your password reset code is:",
    code,
    expiryMinutes,
    footer: "If you did not request this, you can ignore this email."
  });

  return { subject, text, html };
};
