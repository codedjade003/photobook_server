import https from "https";
import http from "http";

const HEALTH_URL = process.env.HEALTH_CHECK_URL || process.env.RENDER_EXTERNAL_URL;
const INTERVAL_MS = parseInt(process.env.KEEP_ALIVE_INTERVAL || "840000"); // 14 minutes default

if (!HEALTH_URL) {
  console.error("❌ HEALTH_CHECK_URL or RENDER_EXTERNAL_URL environment variable is required");
  process.exit(1);
}

const healthEndpoint = `${HEALTH_URL}/health`;
const protocol = HEALTH_URL.startsWith("https") ? https : http;

function pingHealth() {
  const startTime = Date.now();
  
  protocol.get(healthEndpoint, (res) => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode === 200) {
      console.log(`✅ Health check successful (${duration}ms) - ${new Date().toISOString()}`);
    } else {
      console.warn(`⚠️  Health check returned status ${res.statusCode} (${duration}ms)`);
    }
    
    res.resume();
  }).on("error", (err) => {
    const duration = Date.now() - startTime;
    console.error(`❌ Health check failed (${duration}ms):`, err.message);
  });
}

console.log(`🔄 Keep-alive service started`);
console.log(`📍 Target: ${healthEndpoint}`);
console.log(`⏱️  Interval: ${INTERVAL_MS / 1000 / 60} minutes`);
console.log(`🕐 First ping in 1 minute...`);

// First ping after 1 minute
setTimeout(() => {
  pingHealth();
  // Then continue with regular interval
  setInterval(pingHealth, INTERVAL_MS);
}, 60000);
