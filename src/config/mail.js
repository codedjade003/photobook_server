import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "no-reply@photobookhq.com";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const isEmailConfigured = () => {
  // Allow explicit opt-out with EMAIL_FEATURE_ENABLED=false
  if (process.env.EMAIL_FEATURE_ENABLED === "false") return false;
  return Boolean(resendApiKey && resend);
};

/**
 * Send email through Resend using in-house rendered content.
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  if (!isEmailConfigured()) {
    throw new Error("Email service not configured or disabled (RESEND_API_KEY missing or EMAIL_FEATURE_ENABLED=false)");
  }

  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      text,
      html: html || `<p>${(text || "").replace(/\n/g, "<br>")}</p>`
    });

    if (result.error) {
      console.error("❌ Email failed:", result.error);
      throw new Error(`Email failed: ${result.error.message}`);
    }

    console.log(`✅ Email sent to ${to} (ID: ${result.data.id})`);
    return { success: true, id: result.data.id };
  } catch (err) {
    console.error("❌ Email sending error:", err);
    throw new Error(`Failed to send email: ${err.message}`);
  }
};

