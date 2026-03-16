import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL
});

let connectPromise = null;

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
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
