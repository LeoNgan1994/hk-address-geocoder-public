const { isDatabaseAvailable, query } = require("./client");
const { hashNormalized } = require("../cache/cacheKeys");

function isCacheEnabled() {
  if (!isDatabaseAvailable()) {
    return false;
  }
  return process.env.CACHE_ENABLED !== "false";
}

function cacheTtlDays() {
  const days = Number(process.env.CACHE_TTL_DAYS || 90);
  return Number.isFinite(days) && days > 0 ? days : 90;
}

function isCacheableResult(result) {
  return Boolean(result && result.request?.requestFailed !== true);
}

/**
 * @param {string[]} cacheKeys
 * @returns {Promise<{ key: string, entry: object } | null>}
 */
async function findFirstValid(cacheKeys) {
  if (!isCacheEnabled() || !cacheKeys?.length) {
    return null;
  }

  const result = await query(
    `
    SELECT c.cache_key, c.kind, c.query_text, c.provider_id, c.lat, c.lng,
           c.result_json, c.created_at, c.expires_at, c.last_hit_at
    FROM unnest($1::varchar[]) WITH ORDINALITY AS k(cache_key, ord)
    JOIN geocode_cache c ON c.cache_key = k.cache_key
    WHERE c.expires_at > NOW()
    ORDER BY k.ord
    LIMIT 1
    `,
    [cacheKeys]
  );

  if (!result.rows.length) {
    return null;
  }

  const row = result.rows[0];
  await query(`UPDATE geocode_cache SET last_hit_at = NOW() WHERE cache_key = $1`, [
    row.cache_key,
  ]);

  return {
    key: row.cache_key,
    entry: {
      key: row.cache_key,
      kind: row.kind,
      address: row.query_text,
      cachedAt: row.created_at?.toISOString?.() || row.created_at,
      expiresAt: row.expires_at?.toISOString?.() || row.expires_at,
      result: row.result_json,
    },
  };
}

/**
 * @param {string} normalizedInput
 * @param {Array<{ kind: string, cacheKey: string, queryText: string | null, providerId: string | null, lat: number | null, lng: number | null }>} writeEntries
 * @param {object} result
 */
async function upsertMany(normalizedInput, writeEntries, result) {
  if (!isCacheEnabled() || !isCacheableResult(result) || !writeEntries?.length) {
    return [];
  }

  const ttlDays = cacheTtlDays();
  const savedKeys = [];

  for (const entry of writeEntries) {
    await query(
      `
      INSERT INTO geocode_cache (
        cache_key, kind, query_text, provider_id, lat, lng, result_json,
        source_input_hash, expires_at, last_hit_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW() + ($9::int * INTERVAL '1 day'), NOW())
      ON CONFLICT (cache_key) DO UPDATE SET
        kind = EXCLUDED.kind,
        query_text = EXCLUDED.query_text,
        provider_id = EXCLUDED.provider_id,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        result_json = EXCLUDED.result_json,
        source_input_hash = EXCLUDED.source_input_hash,
        expires_at = EXCLUDED.expires_at,
        last_hit_at = NOW()
      `,
      [
        entry.cacheKey,
        entry.kind,
        entry.queryText,
        entry.providerId,
        entry.lat,
        entry.lng,
        JSON.stringify(result),
        hashNormalized(normalizedInput),
        String(ttlDays),
      ]
    );
    savedKeys.push(entry.cacheKey);
  }

  return savedKeys;
}

async function clearAll() {
  if (!isDatabaseAvailable()) {
    return 0;
  }
  const result = await query(`DELETE FROM geocode_cache`);
  return result.rowCount || 0;
}

async function count() {
  if (!isDatabaseAvailable()) {
    return 0;
  }
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM geocode_cache WHERE expires_at > NOW()`
  );
  return result.rows[0]?.count ?? 0;
}

async function purgeExpired() {
  if (!isDatabaseAvailable()) {
    return 0;
  }
  const result = await query(`DELETE FROM geocode_cache WHERE expires_at <= NOW()`);
  return result.rowCount || 0;
}

module.exports = {
  isCacheEnabled,
  isCacheableResult,
  cacheTtlDays,
  findFirstValid,
  upsertMany,
  clearAll,
  count,
  purgeExpired,
};
