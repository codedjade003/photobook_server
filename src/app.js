import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import passport from "passport";
import session from "express-session";
import multer from "multer";
import RedisStore from "connect-redis";
import routes from "./routes/index.js";
import swaggerSpec from "./config/swagger.js";
import { configureGoogleOAuth } from "./config/oauth.js";
import { checkServiceHealth } from "./utils/health.js";
import redisClient from "./config/redis.js";
import { authRateLimiter, globalApiRateLimiter } from "./middleware/rateLimit.js";

const app = express();
app.set("trust proxy", 1);

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SESSION_IDLE_TIMEOUT_MINUTES = parsePositiveInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES, 120);
const sessionMaxAgeMs = SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
const useRedisSessionStore = process.env.NODE_ENV === "production" && Boolean(process.env.REDIS_URL);

// Session secret: prefer value from environment. In production we require it.
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: SESSION_SECRET is required in production but not set.");
    process.exit(1);
  }
  console.warn("Warning: SESSION_SECRET not set; using ephemeral development secret.");
  sessionSecret = "dev-session-secret-change-before-prod";
}

const sessionConfig = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: sessionMaxAgeMs
  }
};

if (useRedisSessionStore) {
  // connect-redis v7 exports a RedisStore class instantiated directly.
  sessionConfig.store = new RedisStore({
    client: redisClient,
    prefix: process.env.SESSION_STORE_PREFIX || "sess:"
  });
}

// Middleware
// CORS_ALLOWED_ORIGINS locks the API down to known web origins. Native apps
// send no Origin header, so they are unaffected either way. When it is unset
// the API stays open (current behaviour) but warns in production.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!allowedOrigins.length) {
  if (process.env.NODE_ENV === "production") {
    console.warn("Warning: CORS_ALLOWED_ORIGINS is not set — the API accepts requests from any origin.");
  }
  app.use(cors());
} else {
  app.use(
    cors({
      origin: (origin, callback) => {
        // No Origin = native app, curl, or same-origin request.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true
    })
  );
}

// Skip JSON parsing for the Paystack webhook — it needs the RAW body
// so we can verify the HMAC-SHA512 signature.
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payments/webhook") return next();
  return express.json()(req, res, next);
});

app.use("/api", globalApiRateLimiter);
app.use("/api/auth", authRateLimiter);

// Session configuration for Passport
app.use(
  session(sessionConfig)
);

// Passport initialization
configureGoogleOAuth();
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint with service pings
app.get("/health", async (req, res) => {
  try {
    const health = await checkServiceHealth();
    res.json(health);
  } catch (err) {
    console.error("Health check error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use("/api", routes);

// Centralized error handling (especially for multer/file upload errors).
app.use((err, req, res, _next) => {
  const context = {
    method: req.method,
    path: req.originalUrl,
    message: err?.message,
    code: err?.code,
    name: err?.name
  };

  if (err instanceof multer.MulterError) {
    console.error("Upload error:", context);
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large" });
    }
    return res.status(400).json({ message: err.message || "Upload failed" });
  }

  if (err?.message && err.message.includes("Invalid file type")) {
    console.error("Upload validation error:", context);
    return res.status(400).json({ message: err.message });
  }

  console.error("Unhandled error:", {
    ...context,
    stack: process.env.NODE_ENV === "production" ? undefined : err?.stack
  });
  return res.status(500).json({ message: "Internal server error" });
});

export default app;
