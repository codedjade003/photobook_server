import redisClient, { ensureRedisConnection } from "../config/redis.js";

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const createSocketRateLimiter = ({ windowMs, max, keyPrefix = "socket" }) => {
  const fallbackHits = new Map();

  const applyFallback = ({ key }) => {
    const now = Date.now();
    const existing = fallbackHits.get(key);

    if (!existing || existing.resetAt <= now) {
      fallbackHits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
    }

    existing.count += 1;
    return { allowed: true };
  };

  return {
    consume: async ({ userId, event }) => {
      const safeUserId = userId || "anonymous";
      const key = `${keyPrefix}:${event}:${safeUserId}`;
      const redisKey = `rl:${key}`;
      const shouldUseRedis = process.env.RATE_LIMIT_USE_REDIS !== "false";

      if (!shouldUseRedis) {
        return applyFallback({ key });
      }

      try {
        await ensureRedisConnection();

        const currentCount = await redisClient.incr(redisKey);
        if (currentCount === 1) {
          await redisClient.pExpire(redisKey, windowMs);
        }

        if (currentCount > max) {
          const ttlMs = await redisClient.pTTL(redisKey);
          const retryAfterSeconds = ttlMs > 0
            ? Math.ceil(ttlMs / 1000)
            : Math.ceil(windowMs / 1000);
          return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
        }

        return { allowed: true };
      } catch (err) {
        console.error("Socket rate limiter Redis fallback:", err.message);
        return applyFallback({ key });
      }
    },
    parseWindowMs: (value, fallback) => parsePositiveInt(value, fallback)
  };
};
