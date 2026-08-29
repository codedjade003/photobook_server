# Firebase Push Notifications — Setup Guide

This backend uses **Firebase Cloud Messaging (FCM)** for push notifications.
`firebase-admin` (server SDK) sends pushes; the client app uses the Firebase
SDK to obtain a device token and POSTs it to us on login.

---

## 1. Create the Firebase project & get the Admin SDK key

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Click **Add project** → name it (e.g. `photobook`) → continue.
   - Google Analytics is optional; you can disable it.
3. Once the project is created, open **Project settings** (gear icon → *Project settings*).
4. Go to the **Service accounts** tab.
5. Click **Generate new private key**.
   - This downloads a JSON file that looks like `photobook-xxxx-firebase-adminsdk-xxxx-xxxxxxxxxx.json`.
6. Place that file in this repo's root as `firebase-service-account.json`
   (it is already in `.gitignore`, so it will **not** be committed), then set:
   ```env
   FIREBASE_SERVICE_ACCOUNT=firebase-service-account.json
   ```
   *Alternative:* on Render / production, don't commit the file. Instead paste the
   **entire JSON contents** into a single environment variable:
   ```env
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
   ```

7. Verify it worked — restart the server and look for:
   ```
   Firebase Admin initialized — push notifications enabled
   ```
   If you instead see `Firebase not configured — push notifications disabled`,
   the env var/path is wrong.

---

## 2. What the client (frontend) needs

The client uses the **Firebase SDK** (not the admin SDK) to obtain an FCM token:

| Platform | SDK |
|----------|-----|
| Android | `@react-native-firebase/messaging` or Firebase Android SDK |
| iOS | `@react-native-firebase/messaging` or Firebase iOS SDK |
| Web | `firebase/messaging` (JS) |

The client also needs the **Firebase Web/App config** (NOT the admin key):

1. In Firebase console → **Project settings → General → Your apps**.
2. Add an app (Android / iOS / Web) and copy the generated config
   (`apiKey`, `messagingSenderId`, `appId`, `projectId`, etc.).
3. Use that config to initialize the Firebase client SDK in the app.
4. Request permission and get the device token:
   ```js
   const token = await messaging().getToken();
   ```

### Register the token with the backend

Right after login (and whenever the token refreshes), call:

```
POST /api/notifications/device-token
Authorization: Bearer <jwt>
Content-Type: application/json

{ "token": "<fcm-token>", "platform": "android" }   // platform: ios | android | web
```

On logout:

```
DELETE /api/notifications/device-token
Authorization: Bearer <jwt>

{ "token": "<fcm-token>" }
```

---

## 3. Where pushes are triggered

| Event | Recipient | Title/Body |
|-------|-----------|------------|
| Incoming WebRTC call (`webrtc_offer`) | The callee(s) | "Incoming Call" |
| New chat message (recipient offline) | Recipient | sender name + message preview |
| Payment confirmed | The client | "Payment Confirmed" |
| Booking accepted (offer accepted) | The client | "Booking Accepted" |

Each push also creates an in-app notification (see `/api/notifications`).

---

## 4. Important security notes

- **The service account JSON is a secret.** Never commit it, never share it.
  It is already gitignored. If it leaks, go to Firebase console →
  *Service accounts* → **Generate new private key** again (generating a new key
  does not revoke the old one automatically — also delete the leaked key in the
  Google Cloud IAM console if needed).
- The client-facing Firebase config (apiKey, messagingSenderId, etc.) is **not**
  a secret — that's normal for client SDKs.
- Invalid/unregistered tokens are cleaned up automatically when a send fails.

---

## 5. Testing locally

1. Set up the service account file + env var (section 1).
2. Start the server: `EMAIL_FEATURE_ENABLED=false PORT=5001 npm run dev`.
3. Confirm the "Firebase Admin initialized" log line.
4. From the Firebase console → **Messaging → Send your first message**, send a
   test notification to a registered token to confirm delivery end-to-end.
