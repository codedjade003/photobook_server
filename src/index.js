import "dotenv/config";

import http from "http";
import app from "./app.js";
import { NODE_ENV } from "./config/env.js";
import { initServiceHealthMonitoring } from "./utils/health.js";
import { ensureRedisConnection } from "./config/redis.js";
import { initMessagingSockets } from "./sockets/messaging.socket.js";
import { initLocationSockets } from "./sockets/location.socket.js";

const PORT = process.env.PORT || 5000;

// Start service health monitoring (pings Redis and Database to keep them awake)
const healthCheckInterval = process.env.HEALTH_CHECK_INTERVAL_MS 
  ? Number(process.env.HEALTH_CHECK_INTERVAL_MS)
  : 5 * 60 * 1000; // Default: 5 minutes

const startServer = async () => {
  // Validate important environment variables
  const requiredInProd = ["SESSION_SECRET", "JWT_SECRET", "MESSAGE_ENCRYPTION_KEY"];
  if (NODE_ENV === "production") {
    const missing = requiredInProd.filter((k) => !process.env[k]);
    if (missing.length) {
      console.error(`Missing required env vars in production: ${missing.join(", ")}`);
      process.exit(1);
    }
  } else {
    const missing = requiredInProd.filter((k) => !process.env[k]);
    if (missing.length) {
      console.warn(`Warning: missing env vars (recommended): ${missing.join(", ")}`);
    }
  }

  if (process.env.REDIS_URL) {
    try {
      await ensureRedisConnection();
      console.log("Redis connected");
    } catch (err) {
      console.error("Redis connection failed:", err.message);
      if (NODE_ENV === "production") {
        process.exit(1);
      }
    }
  }

  initServiceHealthMonitoring(healthCheckInterval);

  const server = http.createServer(app);
  const io = initMessagingSockets(server);
  initLocationSockets(io);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${NODE_ENV} on port ${PORT}`);
    console.log(`Service health checks enabled every ${healthCheckInterval / 1000} seconds`);
  });
};

startServer();
