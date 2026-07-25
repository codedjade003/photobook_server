import { query } from "../config/db.js";
import { createNotification } from "./notification.service.js";
import { sendEmail } from "../config/mail.js";
import { isTruthyEnv } from "../utils/env.js";

let intervalHandle = null;

export const startReminderJob = () => {
  if (intervalHandle) return; // Already running

  console.log("Starting session reminder job (every 60 seconds)");
  intervalHandle = setInterval(checkUpcomingSessions, 60_000);

  // Run once immediately
  checkUpcomingSessions();
};

export const stopReminderJob = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};

async function checkUpcomingSessions() {
  try {
    const now = new Date();
    const in30Min = new Date(now.getTime() + 30 * 60 * 1000);
    const in35Min = new Date(now.getTime() + 35 * 60 * 1000);

    const dateStr30 = in30Min.toISOString().split("T")[0];
    const dateStr35 = in35Min.toISOString().split("T")[0];
    const timeStr30 = in30Min.toTimeString().split(" ")[0];
    const timeStr35 = in35Min.toTimeString().split(" ")[0];

    // Find confirmed sessions starting in 30-35 minutes
    const { rows: sessions } = await query(
      `SELECT s.id, s.client_id, s.photographer_id, s.session_date, s.session_time,
              cu.name AS client_name,
              pu.name AS photographer_name
       FROM sessions s
       INNER JOIN users cu ON cu.id = s.client_id
       INNER JOIN users pu ON pu.id = s.photographer_id
       WHERE s.status = 'confirmed'
         AND (
           (s.session_date = $1 AND s.session_time BETWEEN $2::time AND $3::time)
           OR
           (s.session_date = $4 AND s.session_time BETWEEN $5::time AND $6::time)
         )`,
      [dateStr30, timeStr30, timeStr35, dateStr35, timeStr30, timeStr35]
    );

    for (const session of sessions) {
      // Create notification for client
      await createNotification({
        userId: session.client_id,
        type: "session_reminder",
        title: "Session Reminder",
        body: `Your session with ${session.photographer_name || "your creative"} starts in 30 minutes on ${session.session_date} at ${session.session_time?.slice(0, 5)}.`,
        data: { sessionId: session.id }
      });

      // Create notification for photographer
      await createNotification({
        userId: session.photographer_id,
        type: "session_reminder",
        title: "Session Reminder",
        body: `Your session with ${session.client_name || "your client"} starts in 30 minutes on ${session.session_date} at ${session.session_time?.slice(0, 5)}.`,
        data: { sessionId: session.id }
      });
    }
  } catch (err) {
    console.error("Reminder check failed:", err.message);
  }
}
