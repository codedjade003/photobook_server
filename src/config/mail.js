import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "no-reply@photobookhq.com";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Send email through Resend using in-house rendered content.
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  if (!resendApiKey) {
    throw new Error("Email service not configured (missing RESEND_API_KEY)");
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

