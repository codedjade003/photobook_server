import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import passport from "passport";
import session from "express-session";
import routes from "./routes/index.js";
import swaggerSpec from "./config/swagger.js";
import { configureGoogleOAuth } from "./config/oauth.js";
import { checkServiceHealth } from "./utils/health.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Session configuration for Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
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
