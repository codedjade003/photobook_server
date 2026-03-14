import pool from "../config/db.js";
import redisClient from "../config/redis.js"; // import redis client

/**
 * Check health of all services
 * Pings PostgreSQL and Redis to keep them awake
 */
export const checkServiceHealth = async () => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: { status: "unknown", responseTime: null },
      cache: { status: "unknown", responseTime: null }
    }
  };

  // Check PostgreSQL
  try {
    const startTime = Date.now();
    const result = await pool.query("SELECT NOW()");
    const responseTime = Date.now() - startTime;
    
    health.services.database = {
      status: result.rows.length > 0 ? "ok" : "error",
      responseTime,
      timestamp: result.rows[0].now
    };
  } catch (err) {
    console.error("Database health check failed:", err.message);
    health.services.database = {
      status: "error",
      error: err.message
    };
    health.status = "degraded";
  }

  // Check Redis
  try {
    const startTime = Date.now();
    const result = await redisClient.ping();
    const responseTime = Date.now() - startTime;
    
    health.services.cache = {
      status: result === "PONG" ? "ok" : "error",
      responseTime,
      response: result
    };
  } catch (err) {
    console.error("Redis health check failed:", err.message);
    health.services.cache = {
      status: "error",
      error: err.message
    };
    health.status = "degraded";
  }

  // Try to ping Supabase if configured (same as PostgreSQL check above, but can be separate if needed)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const startTime = Date.now();
      // You can add specific Supabase API health check here if needed
      // For now, PostgreSQL check serves as Supabase check since they use same DB
      const responseTime = Date.now() - startTime;
      health.services.supabase = {
        status: "ok",
        responseTime
      };
    } catch (err) {
      console.error("Supabase health check failed:", err.message);
      health.services.supabase = {
        status: "error",
        error: err.message
      };
      health.status = "degraded";
    }
  }

  return health;
};

/**
 * Periodic health check to keep services alive
 * Call this function to start a background health check interval
 */
export const startPeriodicHealthCheck = (intervalMs = 5 * 60 * 1000) => {
  // Default: every 5 minutes
  console.log(`Starting periodic health check every ${intervalMs / 1000} seconds`);
  
  setInterval(async () => {
    try {
      const health = await checkServiceHealth();
      console.log(`[Health Check] ${health.timestamp}:`, JSON.stringify(health, null, 2));
    } catch (err) {
      console.error("[Health Check Error]:", err);
    }
  }, intervalMs);
};

/**
 * Initialize service health monitoring
 * Can be called from index.js or app.js during startup
 */
export const initServiceHealthMonitoring = (intervalMs) => {
  // Run once immediately
  checkServiceHealth().then(health => {
    console.log("[Startup Health Check]:", JSON.stringify(health, null, 2));
  }).catch(err => {
    console.error("[Startup Health Check Error]:", err);
  });

  // Start periodic checks
  if (process.env.HEALTH_CHECK_ENABLED !== "false") {
    startPeriodicHealthCheck(intervalMs);
  }
};
