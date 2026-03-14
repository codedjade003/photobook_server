import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { NODE_ENV } from "./config/env.js";
import { initServiceHealthMonitoring } from "./utils/health.js";

const PORT = process.env.PORT || 5000;

// Start service health monitoring (pings Redis and Database to keep them awake)
const healthCheckInterval = process.env.HEALTH_CHECK_INTERVAL_MS 
  ? Number(process.env.HEALTH_CHECK_INTERVAL_MS)
  : 5 * 60 * 1000; // Default: 5 minutes

initServiceHealthMonitoring(healthCheckInterval);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running in ${NODE_ENV} on port ${PORT}`);
  console.log(`Service health checks enabled every ${healthCheckInterval / 1000} seconds`);
});
