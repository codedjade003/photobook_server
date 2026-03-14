# Implementation Summary: Email, OAuth & 2FA

## ✅ Completed Features

### 1. **Email Service (Resend)**
- **Replaced**: SMTP-based nodemailer → Resend API
- **Email address**: `no-reply@photobookhq.com`
- **Files modified**:
  - [src/config/mail.js](src/config/mail.js) - Updated to use Resend client
  - [package.json](package.json) - Added `resend` package

**Configuration needed**:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=no-reply@photobookhq.com
EMAIL_FEATURE_ENABLED=true
```

**Usage**:
```javascript
import { sendEmail } from "./config/mail.js";

await sendEmail({
  to: "user@example.com",
  subject: "Email verification",
  text: "Your code is 123456",
  html: "<p>Your code is <strong>123456</strong></p>"
});
```

---

### 2. **Google OAuth Authentication**
- **Framework**: Passport.js with `passport-google-oauth20`
- **Auto-creates users**: New users from Google are created with verified email
- **Files added/modified**:
  - [src/config/oauth.js](src/config/oauth.js) - OAuth configuration (new)
  - [src/services/auth.service.js](src/services/auth.service.js) - Added OAuth methods
  - [src/controllers/auth.controller.js](src/controllers/auth.controller.js) - Added OAuth handlers
  - [src/routes/auth.routes.js](src/routes/auth.routes.js) - Added OAuth routes
  - [src/app.js](src/app.js) - Added Passport integration
  - [package.json](package.json) - Added passport, express-session

**Configuration needed**:
```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
SESSION_SECRET=changeme-with-long-random-string-for-sessions
```

**New endpoint**:
- `POST /api/auth/google` - Google OAuth login/signup

**Database field added**:
- `google_oauth_id` (VARCHAR) - Stores Google unique ID for future logins

---

### 3. **Two-Factor Authentication (2FA/TOTP)**
- **Supports**: Time-based One-Time Password (TOTP) + backup codes
- **Library**: `speakeasy` for TOTP generation/verification, `qrcode` for QR code
- **QR Code**: User scans with authenticator apps (Google Authenticator, Authy, Microsoft Authenticator)
- **Backup codes**: 10 alphanumeric codes generated during setup
- **Files added/modified**:
  - [src/services/twofa.service.js](src/services/twofa.service.js) - 2FA logic (new)
  - [src/repositories/user.repo.js](src/repositories/user.repo.js) - Added 2FA methods
  - [src/services/auth.service.js](src/services/auth.service.js) - Added 2FA handlers
  - [src/controllers/auth.controller.js](src/controllers/auth.controller.js) - Added 2FA endpoints
  - [src/routes/auth.routes.js](src/routes/auth.routes.js) - Added 2FA routes
  - [db/migrations/003_add_2fa_support.sql](db/migrations/003_add_2fa_support.sql) - DB schema (new)

**Database fields added**:
- `two_fa_enabled` (BOOLEAN) - Whether 2FA is enabled
- `two_fa_secret` (VARCHAR) - Base32-encoded TOTP secret
- `two_fa_backup_codes` (TEXT[]) - Array of unused backup codes

**New endpoints**:
- `POST /api/auth/2fa/setup` - Initialize 2FA (returns QR code + backup codes)
- `POST /api/auth/2fa/confirm` - Enable 2FA with TOTP token verification
- `DELETE /api/auth/2fa/disable` - Disable 2FA
- `POST /api/auth/2fa/verify` - Verify TOTP or backup code

**2FA Setup Flow**:
```javascript
// 1. User calls /api/auth/2fa/setup
// Response: { secret, qrCodeUrl, backupCodes }

// 2. User scans QR code with authenticator app
// 3. User enters 6-digit code along with secret and backupCodes
// 4. Backend verifies token and enables 2FA
// POST /api/auth/2fa/confirm { token, secret, backupCodes }
```

---

### 4. **Forgot Password & Password Reset**
*Already implemented in the system, now with Resend email*
- Login already included:
  - `POST /api/auth/password-reset/request` - Send reset code via email
  - `POST /api/auth/password-reset/confirm` - Confirm reset with new password

---

### 5. **Service Health Monitoring**
- **Purpose**: Pings Redis and PostgreSQL to keep free tier services alive
- **Interval**: Every 5 minutes (configurable)
- **Files added/modified**:
  - [src/utils/health.js](src/utils/health.js) - Health check logic (new)
  - [src/app.js](src/app.js) - Integrated health endpoint
  - [src/index.js](src/index.js) - Initialized periodic health checks

**Configuration needed**:
```env
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL_MS=300000  # 5 minutes in milliseconds
```

**Health check endpoint**:
- `GET /health` - Returns status of all services (DB, Redis, Supabase)

**Example response**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-14T10:30:00.000Z",
  "services": {
    "database": {
      "status": "ok",
      "responseTime": 45,
      "timestamp": "2026-03-14T10:30:00.000Z"
    },
    "cache": {
      "status": "ok",
      "responseTime": 12,
      "response": "PONG"
    }
  }
}
```

---

## 📦 Dependencies Added

```json
{
  "express-session": "^1.17.3",
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "qrcode": "^1.5.3",
  "resend": "^0.0.8",
  "speakeasy": "^2.0.0"
}
```

---

## 🗄️ Database Migrations

**Run this SQL to add 2FA support** (file: [db/migrations/003_add_2fa_support.sql](db/migrations/003_add_2fa_support.sql)):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_backup_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_oauth_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_google_oauth_id ON users(google_oauth_id);
CREATE INDEX IF NOT EXISTS idx_last_login ON users(last_login_at DESC);
```

---

## 🔐 Environment Variables (Complete List)

See [env.example](../env.example) for full reference. Key new variables:

### Email (Resend)
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=no-reply@photobookhq.com
```

### Google OAuth
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
SESSION_SECRET=xxx-change-me-xxx
```

### Health Checks
```env
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL_MS=300000
```

---

## 🚀 Next Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup environment variables**:
   - Copy `env.example` to `.env`
   - Add Resend API key: https://resend.com
   - Add Google OAuth credentials: https://console.cloud.google.com

3. **Run database migration**:
   ```sql
   -- Execute the SQL from db/migrations/003_add_2fa_support.sql
   ```

4. **Test endpoints**:
   - Email verification: `POST /api/auth/signup`
   - Google OAuth: `POST /api/auth/google`
   - 2FA setup: `POST /api/auth/2fa/setup`
   - Health check: `GET /health`

---

## 📝 Notes

- **Email verification**: Enabled when `EMAIL_FEATURE_ENABLED=true`
- **Password reset**: Works with Resend; check spam folder if not received
- **2FA optional**: Users can enable/disable 2FA independently
- **Google OAuth**: Auto-creates users with verified email status
- **Health checks**: Prevents free tier services (Supabase, Redis) from hibernating
- **Backup codes**: Each 2FA setup generates 10 backup codes; store securely

---

## 🔗 Related Routes

**Auth endpoints**:
- POST `/api/auth/signup` - Email/password signup
- POST `/api/auth/login` - Email/password login
- POST `/api/auth/verify-email` - Email verification
- POST `/api/auth/password-reset/request` - Request reset code
- POST `/api/auth/password-reset/confirm` - Confirm password reset
- POST `/api/auth/google` - Google OAuth login
- POST `/api/auth/2fa/setup` - Setup 2FA
- POST `/api/auth/2fa/confirm` - Enable 2FA
- DELETE `/api/auth/2fa/disable` - Disable 2FA
- POST `/api/auth/2fa/verify` - Verify 2FA during login

**System endpoints**:
- GET `/health` - Full service health check
- GET `/api/auth/me` - Current authenticated user
