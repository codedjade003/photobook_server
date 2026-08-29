import admin from "firebase-admin";
import fs from "fs";

let initialized = false;
let configured = false;

const credentialPath =
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "";
const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";

export const isFirebaseConfigured = () => configured;

export const initFirebase = () => {
  if (initialized) return;

  try {
    if (admin.getApps().length > 0) {
      configured = true;
      initialized = true;
      return;
    }

    let credential = null;

    // firebase-admin v14+: `cert()` is a top-level export (was credential.cert).
    if (credentialJson) {
      // Raw JSON string (e.g. Render env var).
      credential = admin.cert(JSON.parse(credentialJson));
    } else if (credentialPath && fs.existsSync(credentialPath)) {
      // Path to the service account JSON file — cert() reads it directly.
      credential = admin.cert(credentialPath);
    } else {
      console.warn(
        "Firebase not configured — push notifications disabled. " +
        "Set FIREBASE_SERVICE_ACCOUNT (path to service account JSON) or " +
        "FIREBASE_SERVICE_ACCOUNT_JSON."
      );
      initialized = true;
      return;
    }

    admin.initializeApp({ credential });
    configured = true;
    console.log("Firebase Admin initialized — push notifications enabled");
  } catch (err) {
    console.error("Firebase initialization failed:", err.message);
    configured = false;
  }

  initialized = true;
};

export default admin;
