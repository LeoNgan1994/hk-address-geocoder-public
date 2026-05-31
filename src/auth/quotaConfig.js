function getDefaultDailyQuota() {
  const n = Number(process.env.RATE_LIMIT_DAILY || 3000);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3000;
}

function getDefaultPerMinuteQuota() {
  const n = Number(process.env.RATE_LIMIT_PER_MINUTE || 120);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

const MAX_DAILY_QUOTA = 10_000_000;
const MAX_PER_MINUTE_QUOTA = 10_000;

/**
 * Parse optional quota from API body. null/undefined → use system default (stored as null in DB).
 */
function parseQuotaFields(body = {}) {
  const result = { dailyQuota: undefined, rateLimitPerMinute: undefined };

  if (body.dailyQuota === null) {
    result.dailyQuota = null;
  } else if (body.dailyQuota !== undefined) {
    const n = Number(body.dailyQuota);
    if (!Number.isFinite(n) || n < 1 || n > MAX_DAILY_QUOTA) {
      return {
        ok: false,
        message: `dailyQuota 須為 1–${MAX_DAILY_QUOTA} 的整數，或 null 使用預設`,
      };
    }
    result.dailyQuota = Math.floor(n);
  }

  if (body.rateLimitPerMinute === null) {
    result.rateLimitPerMinute = null;
  } else if (body.rateLimitPerMinute !== undefined) {
    const n = Number(body.rateLimitPerMinute);
    if (!Number.isFinite(n) || n < 1 || n > MAX_PER_MINUTE_QUOTA) {
      return {
        ok: false,
        message: `rateLimitPerMinute 須為 1–${MAX_PER_MINUTE_QUOTA} 的整數，或 null 使用預設`,
      };
    }
    result.rateLimitPerMinute = Math.floor(n);
  }

  return { ok: true, ...result };
}

function resolveEffectiveQuota(row) {
  return {
    dailyQuota: row?.daily_quota != null ? Number(row.daily_quota) : getDefaultDailyQuota(),
    rateLimitPerMinute:
      row?.rate_limit_per_minute != null
        ? Number(row.rate_limit_per_minute)
        : getDefaultPerMinuteQuota(),
    dailyQuotaIsDefault: row?.daily_quota == null,
    rateLimitPerMinuteIsDefault: row?.rate_limit_per_minute == null,
  };
}

module.exports = {
  getDefaultDailyQuota,
  getDefaultPerMinuteQuota,
  parseQuotaFields,
  resolveEffectiveQuota,
  MAX_DAILY_QUOTA,
  MAX_PER_MINUTE_QUOTA,
};
