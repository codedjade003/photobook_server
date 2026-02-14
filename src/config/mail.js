import nodemailer from "nodemailer";

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

export const sendEmail = async ({ to, subject, text }) => {
  if (!smtpConfigured) {
    console.warn("SMTP not configured. Skipping outbound email:", { to, subject });
    return;
  }
  await transporter.sendMail({
    from: `"${process.env.APP_NAME || "Photobook"}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text
  });
};
