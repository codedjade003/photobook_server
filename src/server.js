import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import connectDB from "./config/db.js";
import passport from "./config/passport.js";
import swaggerSpec from "./config/swagger.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";

connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

app.get("/", (req, res) => res.send("Photobook API running ✅"));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     description: Returns server health status, uptime, and environment info. Used for monitoring and keep-alive services.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-10-22T19:18:50.790Z
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 3.005766353
 *                 environment:
 *                   type: string
 *                   example: development
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Swagger documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Photobook API Docs"
}));

app.use("/api/auth", authRoutes);

app.use("/api", profileRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
