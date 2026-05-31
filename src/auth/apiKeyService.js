const apiKeyRepository = require("../db/apiKeyRepository");
const { getAdminApiKey } = require("./apiKeyConfig");
const { hashApiKey, generateApiKey, keyPrefix, secureCompare } = require("./apiKeyCrypto");
const { resolveEffectiveQuota } = require("./quotaConfig");

function toPublicKeyRecord(row, usage = null) {
  if (!row) {
    return null;
  }
  const quota = resolveEffectiveQuota(row);
  const record = {
    id: row.id,
    prefix: row.key_prefix,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    dailyQuota: row.daily_quota,
    rateLimitPerMinute: row.rate_limit_per_minute,
    effectiveQuota: {
      dailyQuota: quota.dailyQuota,
      rateLimitPerMinute: quota.rateLimitPerMinute,
      dailyQuotaIsDefault: quota.dailyQuotaIsDefault,
      rateLimitPerMinuteIsDefault: quota.rateLimitPerMinuteIsDefault,
    },
  };
  if (usage) {
    record.usage = usage;
  }
  return record;
}

function isExpired(row) {
  if (!row?.expires_at) {
    return false;
  }
  return new Date(row.expires_at).getTime() <= Date.now();
}

function isAdminApiKey(rawKey) {
  return secureCompare(String(rawKey || ""), getAdminApiKey());
}

function authFromRow(row) {
  const quota = resolveEffectiveQuota(row);
  return {
    mode: "client",
    keyId: row.id,
    keyName: row.name,
    isAdmin: false,
    source: "database",
    dailyQuota: quota.dailyQuota,
    rateLimitPerMinute: quota.rateLimitPerMinute,
  };
}

async function validateApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== "string") {
    return null;
  }

  if (isAdminApiKey(rawKey)) {
    return {
      mode: "admin",
      keyId: "admin",
      keyName: "admin",
      isAdmin: true,
      source: "maintenance",
      dailyQuota: null,
      rateLimitPerMinute: null,
    };
  }

  const row = await apiKeyRepository.findByHash(hashApiKey(rawKey));
  if (!row || !row.enabled || isExpired(row)) {
    return null;
  }

  apiKeyRepository.touchLastUsed(row.id).catch(() => {});

  return authFromRow(row);
}

async function createClientKey({
  name,
  description,
  expiresAt,
  createdBy,
  dailyQuota,
  rateLimitPerMinute,
}) {
  const apiKey = generateApiKey();
  const row = await apiKeyRepository.insertKey({
    keyPrefix: keyPrefix(apiKey),
    keyHash: hashApiKey(apiKey),
    name,
    description,
    expiresAt: expiresAt || null,
    createdBy,
    dailyQuota: dailyQuota ?? null,
    rateLimitPerMinute: rateLimitPerMinute ?? null,
  });

  return {
    record: toPublicKeyRecord(row),
    apiKey,
  };
}

async function listClientKeys(getUsageForKey) {
  const rows = await apiKeyRepository.listKeys();
  return rows.map((row) => {
    const usage = getUsageForKey ? getUsageForKey(String(row.id)) : null;
    return toPublicKeyRecord(row, usage);
  });
}

async function updateClientKey(id, fields) {
  const row = await apiKeyRepository.updateKey(id, fields);
  return toPublicKeyRecord(row);
}

async function getClientKey(id, getUsageForKey) {
  const row = await apiKeyRepository.findById(id);
  if (!row) {
    return null;
  }
  const usage = getUsageForKey ? getUsageForKey(String(row.id)) : null;
  return toPublicKeyRecord(row, usage);
}

async function revokeClientKey(id) {
  const row = await apiKeyRepository.deleteKey(id);
  return row ? { id: row.id, revoked: true } : null;
}

module.exports = {
  validateApiKey,
  isAdminApiKey,
  createClientKey,
  listClientKeys,
  updateClientKey,
  getClientKey,
  revokeClientKey,
  toPublicKeyRecord,
  authFromRow,
};
