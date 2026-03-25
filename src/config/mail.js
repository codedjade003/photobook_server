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
 * @param {string} options.templateId - Resend template ID
 * @param {Object} options.templateVariables - Variables to pass to template (e.g., { code: "123456" })
 */
export const sendEmail = async ({ to, subject, text, html, templateId, templateVariables }) => {
  if (!resendApiKey) {
    throw new Error("Email service not configured (missing RESEND_API_KEY)");
  }

  try {
    let result;

    if (templateId) {
      try {
        result = await resend.emails.send({
          from: emailFrom,
          to,
          template: {
            id: templateId,
            variables: templateVariables || {}
          }
        });
      } catch (templateErr) {
        console.warn("Template send failed, falling back to plain email:", templateErr.message);
      }
    }

    if (!result) {
      result = await resend.emails.send({
        from: emailFrom,
        to,
        subject,
        text,
        html: html || `<p>${(text || "").replace(/\n/g, "<br>")}</p>`
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

