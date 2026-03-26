# Setup Checklist: PhotoBook Backend

## 🔧 Installation & Configuration

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Obtain Required Credentials

#### A. Resend API Key (for emails)
1. Go to https://resend.com
2. Sign up or log in
3. Create a new API key
4. Add to `.env`: `RESEND_API_KEY=re_xxxxxxxxxxxxx`

**Verification:**
- Domain: photobookhq.com (should be verified in Resend)
- Email address: no-reply@photobookhq.com
- Update `.env`: `EMAIL_FROM=no-reply@photobookhq.com`

#### B. Google OAuth Credentials
1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:5000/api/auth/google/callback` (dev)
     - `https://yourdomain.com/api/auth/google/callback` (production)
5. Copy credentials to `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
   ```
6. Add session secret (generate random string):
   ```env
   SESSION_SECRET=your-random-string-here-minimum-32-chars
   ```

### Step 3: Database Setup

Execute the migration to add 2FA columns:

```sql
-- Run this SQL against your PostgreSQL database
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_backup_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_oauth_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_google_oauth_id ON users(google_oauth_id);
CREATE INDEX IF NOT EXISTS idx_last_login ON users(last_login_at DESC);
```

Or use the migration file:
```bash
# Using your migration tool (e.g., node-pg-migrate, sequel, etc.)
psql -U postgres -d photobook -f db/migrations/003_add_2fa_support.sql
psql -U postgres -d photobook -f db/migrations/004_auth_hardening.sql
```

### Step 4: Environment Variables

Copy and configure `.env` file:

```env
# === Copy from env.example ===
cp env.example .env

# === Update with your values ===
# Email
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=no-reply@photobookhq.com

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
SESSION_SECRET=your-secret-key-here

# Health Checks (Optional)
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL_MS=300000

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/photobook

# Redis
REDIS_URL=redis://localhost:6379
```

### Step 5: Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

### Step 6: Verify Setup

```bash
# Check if server is running and services are healthy
curl http://localhost:5000/health

# Expected response:
# {
#   "status": "ok",
#   "services": {
#     "database": { "status": "ok", "responseTime": 45 },
#     "cache": { "status": "ok", "responseTime": 12 }
#   }
# }
```

---

## 🧪 Testing Endpoints

### Email Verification (Signup)
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePassword123",
    "role": "client"
  }'
```

### Password Reset
```bash
# Request reset code
curl -X POST http://localhost:5000/api/auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com"}'

# Confirm with reset code
curl -X POST http://localhost:5000/api/auth/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "code": "123456",
    "newPassword": "NewPassword123"
  }'
```

### 2FA Setup
```bash
# 1. Get QR code and backup codes
curl -X POST http://localhost:5000/api/auth/2fa/setup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# 2. Enable 2FA (after scanning QR code)
curl -X POST http://localhost:5000/api/auth/2fa/confirm \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456",
    "secret": "base32secret",
    "backupCodes": ["CODE1", "CODE2", ...]
  }'

# 3. Verify 2FA code
curl -X POST http://localhost:5000/api/auth/2fa/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token": "123456"}'
```

### Search & Discovery
```bash
# Discover photographers with ranking and filters
curl "http://localhost:5000/api/search/users?role=photographer&sort=relevance&tags=portrait,event&minRating=4&limit=20"

# Portfolio media search
curl "http://localhost:5000/api/search/portfolio?q=bridal&mediaType=image&sort=relevance"

# Similar creators and similar portfolio recommendations
curl "http://localhost:5000/api/search/users/USER_ID/similar?limit=12"
curl "http://localhost:5000/api/search/portfolio/ITEM_ID/similar?limit=12"

# Trending tags for auto-suggest
curl "http://localhost:5000/api/search/tags/trending?limit=20"
```

### Google OAuth
```bash
curl -X POST http://localhost:5000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "id": "google-id-123",
      "displayName": "John Doe",
      "emails": [{"value": "john@gmail.com"}]
    }
  }'
```

### Health Check
```bash
curl http://localhost:5000/health
```

---

## ✅ Verification Checklist

- [ ] All dependencies installed (`npm install`)
- [ ] Resend API key obtained and added to `.env`
- [ ] Google OAuth credentials created and added to `.env`
- [ ] Database migration executed (2FA columns added)
- [ ] `.env` file configured with all required variables
- [ ] Redis is running and accessible
- [ ] PostgreSQL is running and accessible
- [ ] Server starts without errors (`npm run dev`)
- [ ] Health check endpoint responds (`GET /health`)
- [ ] Email verification works (test signup)
- [ ] Password reset works (test password reset flow)
- [ ] 2FA setup works (test /2fa/setup endpoint)
- [ ] Google OAuth works (test with test profile)

---

## 🔒 Security Reminders

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use strong SESSION_SECRET** - At least 32 random characters
3. **Keep API keys private** - Resend and Google keys are sensitive
4. **Use HTTPS in production** - Set `secure: true` in session cookie config
5. **Enable email verification** - Set `EMAIL_FEATURE_ENABLED=true`
6. **Backup 2FA codes** - Advise users to save them securely
7. **Monitor health checks** - Set reasonable interval to keep services alive

---

## 📚 Documentation

- Full implementation guide: [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)
- Swagger API docs: http://localhost:5000/api-docs
- Environment variables: [env.example](env.example)
