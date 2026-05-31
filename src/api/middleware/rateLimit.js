const { ApiError } = require("../errors");
const {
  getDefaultDailyQuota,
  getDefaultPerMinuteQuota,
} = require("../../auth/quotaConfig");

/** In-memory counters per API key id (admin / client uuid / anonymous). */
const buckets = new Map();

function hkDateKey(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

function minuteKey(date = new Date()) {
  const parts = date.toLocaleString("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return parts.replace(",", "");
}

function isRateLimitEnabled() {
  return process.env.RATE_LIMIT_ENABLED !== "false";
}

function getEnvLimits() {
  return {
    daily: getDefaultDailyQuota(),
    perMinute: getDefaultPerMinuteQuota(),
  };
}

/** Limits for this request (per-key quota or env default for anonymous). */
function resolveLimitsForRequest(req) {
  const auth = req.auth || {};
  if (auth.isAdmin) {
    return null;
  }
  if (auth.keyId && auth.dailyQuota != null) {
    return {
      daily: auth.dailyQuota,
      perMinute: auth.rateLimitPerMinute ?? getDefaultPerMinuteQuota(),
    };
  }
  return getEnvLimits();
}

function getRateLimitKey(req) {
  const auth = req.auth || {};
  if (auth.keyId) {
    return String(auth.keyId);
  }
  const ip = req.requestContext?.clientIp || req.ip || "unknown";
  return `ip:${ip}`;
}

function getBucket(key) {
  if (!buckets.has(key)) {
    buckets.set(key, { day: {}, minute: {} });
  }
  return buckets.get(key);
}

function getUsageSnapshot(key) {
  const bucket = buckets.get(key);
  const day = hkDateKey();
  const minute = minuteKey();
  return {
    dayKey: day,
    minuteKey: minute,
    dayCount: bucket?.day?.[day] || 0,
    minuteCount: bucket?.minute?.[minute] || 0,
  };
}

function checkAndConsume(key, limits) {
  const bucket = getBucket(key);
  const day = hkDateKey();
  const minute = minuteKey();

  if (!bucket.day[day]) {
    bucket.day[day] = 0;
  }
  if (!bucket.minute[minute]) {
    bucket.minute[minute] = 0;
  }

  if (bucket.day[day] >= limits.daily) {
    return {
      allowed: false,
      limit: limits.daily,
      remaining: 0,
      window: "day",
      resetAt: `${day}T23:59:59+08:00`,
      dayCount: bucket.day[day],
      minuteCount: bucket.minute[minute],
    };
  }
  if (bucket.minute[minute] >= limits.perMinute) {
    return {
      allowed: false,
      limit: limits.perMinute,
      remaining: 0,
      window: "minute",
      resetAt: "next minute (HK)",
      dayCount: bucket.day[day],
      minuteCount: bucket.minute[minute],
    };
  }

  bucket.day[day] += 1;
  bucket.minute[minute] += 1;

  return {
    allowed: true,
    dailyLimit: limits.daily,
    dailyRemaining: limits.daily - bucket.day[day],
    minuteLimit: limits.perMinute,
    minuteRemaining: limits.perMinute - bucket.minute[minute],
    dayCount: bucket.day[day],
    minuteCount: bucket.minute[minute],
  };
}

function getUsageForAuthKey(keyId) {
  if (!keyId || keyId === "admin") {
    return null;
  }
  const snap = getUsageSnapshot(String(keyId));
  return {
    today: snap.dayKey,
    requestsToday: snap.dayCount,
    requestsThisMinute: snap.minuteCount,
  };
}

function rateLimitMiddleware(req, res, next) {
  if (!isRateLimitEnabled()) {
    return next();
  }

  const limits = resolveLimitsForRequest(req);
  if (!limits) {
    return next();
  }

  const key = getRateLimitKey(req);
  const outcome = checkAndConsume(key, limits);

  res.setHeader("X-RateLimit-Limit-Day", String(limits.daily));
  res.setHeader("X-RateLimit-Limit-Minute", String(limits.perMinute));

  if (outcome.allowed) {
    res.setHeader("X-RateLimit-Remaining-Day", String(outcome.dailyRemaining));
    res.setHeader("X-RateLimit-Remaining-Minute", String(outcome.minuteRemaining));
    return next();
  }

  res.setHeader("X-RateLimit-Remaining-Day", String(Math.max(0, limits.daily - outcome.dayCount)));
  res.setHeader("Retry-After", outcome.window === "minute" ? "60" : "3600");

  return next(
    new ApiError(
      429,
      "rate_limit_exceeded",
      outcome.window === "day"
        ? `已超過每日配額（${outcome.limit} 次／日）`
        : `已超過每分鐘配額（${outcome.limit} 次／分鐘）`,
      "rate_limit",
      {
        window: outcome.window,
        limit: outcome.limit,
        resetAt: outcome.resetAt,
        usage: {
          requestsToday: outcome.dayCount,
          requestsThisMinute: outcome.minuteCount,
        },
      }
    )
  );
}

function resetRateLimitBuckets() {
  buckets.clear();
}

module.exports = {
  rateLimitMiddleware,
  isRateLimitEnabled,
  getEnvLimits,
  getUsageForAuthKey,
  resetRateLimitBuckets,
  resolveLimitsForRequest,
};
