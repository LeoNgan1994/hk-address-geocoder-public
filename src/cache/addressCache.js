const cacheKeys = require("./cacheKeys");
const geocodeCacheRepository = require("../db/geocodeCacheRepository");

/**
 * PostgreSQL-backed geocode result cache (Plan B).
 * Requires DATABASE_URL; disabled when CACHE_ENABLED=false or no DB.
 */

async function get(normalizedInput, extraction = null) {
  const keys = cacheKeys.buildLookupKeys(normalizedInput, extraction);
  return geocodeCacheRepository.findFirstValid(keys);
}

async function set(normalizedInput, extraction, selectedAttempt, result) {
  if (!geocodeCacheRepository.isCacheableResult(result)) {
    return null;
  }
  const writeEntries = cacheKeys.buildWriteEntries(
    normalizedInput,
    extraction,
    selectedAttempt,
    result
  );
  return geocodeCacheRepository.upsertMany(normalizedInput, writeEntries, result);
}

module.exports = {
  ...cacheKeys,
  isCacheEnabled: geocodeCacheRepository.isCacheEnabled,
  get,
  set,
  clearAll: geocodeCacheRepository.clearAll,
  count: geocodeCacheRepository.count,
  purgeExpired: geocodeCacheRepository.purgeExpired,
  isCacheableResult: geocodeCacheRepository.isCacheableResult,
};
