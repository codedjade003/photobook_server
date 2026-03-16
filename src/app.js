import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import passport from "passport";
import session from "express-session";
import RedisStore from "connect-redis";
import routes from "./routes/index.js";
import swaggerSpec from "./config/swagger.js";
import { configureGoogleOAuth } from "./config/oauth.js";
import { checkServiceHealth } from "./utils/health.js";
import redisClient from "./config/redis.js";

const app = express();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SESSION_IDLE_TIMEOUT_MINUTES = parsePositiveInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES, 120);
const sessionMaxAgeMs = SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
const useRedisSessionStore = process.env.NODE_ENV === "production" && Boolean(process.env.REDIS_URL);

const sessionConfig = {
  secret: process.env.SESSION_SECRET || "change-me-in-production",
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
  sessionConfig.store = new RedisStore({
    client: redisClient,
    prefix: process.env.SESSION_STORE_PREFIX || "sess:"
  });
}

// Middleware
app.use(cors());
app.use(express.json());

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

export default app;
