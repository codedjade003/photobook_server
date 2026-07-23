import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff: wait 1s, 2s, 4s, 8s... max 30s
      const delay = Math.min(Math.pow(2, retries) * 1000, 30000);
      console.log(`Redis reconnect attempt ${retries + 1} in ${delay}ms`);
      return delay;
    },
    connectTimeout: 10000, // 10 second connection timeout
  },
});

let connectPromise = null;

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

export const ensureRedisConnection = async () => {
  if (redis.isOpen) return redis;
  if (!connectPromise) {
    connectPromise = redis.connect().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  await connectPromise;
  return redis;
};

export default redis;
