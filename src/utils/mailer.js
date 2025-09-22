import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,       // e.g. smtp.gmail.com
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,     // your email address
    pass: process.env.SMTP_PASS      // your email password or app password
  }
});

export const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: `"PhotoBook" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    throw new Error("Failed to send email");
  }
};
