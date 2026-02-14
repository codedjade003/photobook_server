# Photobook Backend

Production-oriented Node.js/Express backend for a two-sided photography marketplace.

## Current Scope

This backend currently supports the core MVP flow:
- User signup/login with JWT
- Role selection (`client` or `photographer`)
- Photographer profile updates
- Rate card creation/listing
- Portfolio media upload to Backblaze B2 and metadata storage in Postgres
- Portfolio media deletion from B2 and Postgres
- Client session booking
- Session listing for both clients and photographers
- Interactive API docs via Swagger (`/api-docs`)

## Stack

- Runtime: Node.js 20+
- Framework: Express
- DB: PostgreSQL
- Cache/queue baseline: Redis
- Object storage: Backblaze B2 (S3-compatible)
- Realtime baseline: Socket.io
- Validation: Zod
- API docs: Swagger JSDoc + Swagger UI

## Project Structure

See `STRUCTURE.txt` for the full tree.

## Environment Variables

Copy and edit:

```bash
cp .env.example .env
```

Required for running core API:
- `JWT_SECRET`
- Postgres vars (`DATABASE_URL` or `PG*`)

Required for portfolio file uploads:
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_NAME`
- `B2_ENDPOINT`
- Recommended: `B2_DOWNLOAD_URL`

Optional for email flows:
- `EMAIL_FEATURE_ENABLED=true`
- SMTP vars

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Run migrations

```bash
psql '<YOUR_DATABASE_URL>' -f src/db/migrations/001_init.sql
psql '<YOUR_DATABASE_URL>' -f src/db/migrations/002_domain_alignment.sql
```

3. Start server

```bash
npm run dev
```

4. Open docs

- `http://localhost:5000/api-docs`

## Scripts

- `npm run dev` - run in dev mode with nodemon
- `npm start` - run production server
- `npm run test:smoke` - executes end-to-end smoke flow

## API Overview

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `PATCH /api/auth/role`
- `GET /api/auth/me`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`

### Profiles
- `GET /api/profiles/me`
- `PUT /api/profiles/photographer`
- `PUT /api/profiles/client`

### Rate Card
- `POST /api/rate-card`
- `GET /api/rate-card/me`
- `GET /api/rate-card/:photographerId`

### Portfolio
- `POST /api/portfolio/upload` (multipart upload to B2)
- `POST /api/portfolio` (manual URL/metadata insert)
- `GET /api/portfolio/me`
- `DELETE /api/portfolio/:itemId` (deletes from B2 then DB)

### Sessions
- `GET /api/sessions/event-types`
- `POST /api/sessions`
- `GET /api/sessions/me`

Detailed request bodies are documented in `/api-docs`.

## Portfolio Upload Contract

`POST /api/portfolio/upload` (`multipart/form-data`)

Fields:
- `file` (required)
- `title` (optional)
- `description` (optional)
- `tags` (optional: JSON array string or comma-separated)
- `durationSeconds` (required for video)
- `isCover` (optional)

Constraints:
- Allowed types: `jpeg`, `jpg`, `png`, `webp`, `mp4`, `mov`
- Max file size: `MAX_UPLOAD_MB`
- Max video duration: `MAX_VIDEO_SECONDS`
- Per-photographer media quota enforced in DB (`media_limit_bytes`, default 1GB)

## Smoke Testing

Run the API, then:

```bash
npm run test:smoke
```

Script path:
- `scripts/smoke-test.js`

It creates a photographer and client, sets profile/rate card/portfolio, books a session, and verifies session visibility for both users.

## Deploying on Render

You can host all core components on Render.

### Minimum production setup
- 1 Web Service (this backend)
- 1 PostgreSQL instance (Render managed)
- 1 Redis/Key Value instance (Render managed)

### Steps
1. Create PostgreSQL on Render and copy the internal DB URL.
2. Create Redis/Key Value on Render and copy its connection URL.
3. Create Web Service from this repo.
4. Set env vars on the Web Service:
- `NODE_ENV=production`
- `DATABASE_URL=<render-postgres-url>`
- `REDIS_URL=<render-redis-url>`
- `JWT_SECRET=<secure-random-string>`
- `B2_*` vars
5. Deploy.
6. Run migrations against production DB:

```bash
psql '<PROD_DATABASE_URL>' -f src/db/migrations/001_init.sql
psql '<PROD_DATABASE_URL>' -f src/db/migrations/002_domain_alignment.sql
```

### Render vs Supabase/other providers
- You do **not** need Supabase if you are already using Render Postgres + Render Redis.
- Use Supabase only if you specifically want Supabase features (auth, realtime, pg extensions, dashboard workflow).
- For your current architecture, staying on Render for app + Postgres + Redis is simpler operationally.

## Operational Notes

- Rotate secrets if they were ever pasted publicly.
- Keep `EMAIL_FEATURE_ENABLED=false` until SMTP is fully configured.
- For production API docs, set `API_BASE_URL` to your Render service URL.

## Quick Integration References

- End-to-end route walkthrough: `ROUTES_TEST_GUIDE.txt`
- Swagger docs: `/api-docs`
# photobook_server
