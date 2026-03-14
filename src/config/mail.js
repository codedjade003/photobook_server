import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "no-reply@photobookhq.com";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Send email using Resend templates or raw email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body (fallback)
 * @param {string} options.html - HTML body (fallback)
 * @param {string} options.templateId - Resend template ID (overrides subject/text/html)
 * @param {Object} options.templateVariables - Variables to pass to template (e.g., { code: "123456" })
 */
export const sendEmail = async ({ to, subject, text, html, templateId, templateVariables }) => {
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured. Skipping email:", { to, subject });
    return { success: false, error: "Email service not configured" };
  }

  try {
    let result;

    // If template ID is provided, use template-based sending
    if (templateId) {
      result = await resend.emails.send({
        from: emailFrom,
        to,
        template: templateId,
        props: templateVariables || {}
      });
    } else {
      // Fallback to raw email sending
      result = await resend.emails.send({
        from: emailFrom,
        to,
        subject,
        text,
        html: html || `<p>${text.replace(/\n/g, "<br>")}</p>`
      });
    }

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

