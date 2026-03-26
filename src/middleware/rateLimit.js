import redisClient, { ensureRedisConnection } from "../config/redis.js";

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const createRateLimiter = ({
  windowMs,
  max,
  keyPrefix = "global",
  message = "Too many requests"
}) => {
  const fallbackHits = new Map();

  const applyFallback = (req, res, next) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const existing = fallbackHits.get(key);

    if (!existing || existing.resetAt <= now) {
      fallbackHits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({ message });
    }

    existing.count += 1;
    return next();
  };

  return async (req, res, next) => {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const redisKey = `rl:${key}`;

    const shouldUseRedis = process.env.RATE_LIMIT_USE_REDIS !== "false";
    if (!shouldUseRedis) {
      return applyFallback(req, res, next);
    }

    try {
      await ensureRedisConnection();

      const currentCount = await redisClient.incr(redisKey);
      if (currentCount === 1) {
        await redisClient.pExpire(redisKey, windowMs);
      }

      if (currentCount > max) {
        const ttlMs = await redisClient.pTTL(redisKey);
        const retryAfterSeconds = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000);
        res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
        return res.status(429).json({ message });
      }

      return next();
    } catch (err) {
      console.error("Rate limiter Redis fallback:", err.message);
      return applyFallback(req, res, next);
    }
  };
};

export const globalApiRateLimiter = createRateLimiter({
  windowMs: parsePositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveInt(process.env.API_RATE_LIMIT_MAX, 600),
  keyPrefix: "api",
  message: "Too many API requests, please try again later"
});

export const authRateLimiter = createRateLimiter({
  windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 120),
  keyPrefix: "auth",
  message: "Too many authentication attempts, please try again later"
});
