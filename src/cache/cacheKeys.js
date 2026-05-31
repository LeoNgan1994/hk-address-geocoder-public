const crypto = require("crypto");

function normalizeAddress(address) {
  return String(address || "").trim().replace(/\s+/g, " ");
}

function hashNormalized(text) {
  return crypto.createHash("sha256").update(normalizeAddress(text), "utf8").digest("hex");
}

function inputCacheKey(normalizedInput) {
  return `input:${hashNormalized(normalizedInput)}`;
}

function manholeCacheKey(manholeId) {
  return `manhole:${String(manholeId || "").toUpperCase()}`;
}

function lampCacheKey(lampPostId) {
  return `lamp:${String(lampPostId || "").toUpperCase()}`;
}

function addressCacheKey(geocodeQuery) {
  return `addr:${hashNormalized(geocodeQuery)}`;
}

/** @deprecated use inputCacheKey — kept for logs */
function cacheKeyForAddress(address) {
  return inputCacheKey(normalizeAddress(address));
}

/**
 * Keys tried on lookup (order matters: exact input first, then semantic).
 * @param {string} normalizedInput
 * @param {object | null} extraction
 */
function buildLookupKeys(normalizedInput, extraction = null) {
  const keys = [];
  const seen = new Set();

  function add(key) {
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    keys.push(key);
  }

  add(inputCacheKey(normalizedInput));

  if (!extraction) {
    return keys;
  }

  if (extraction.manholeId) {
    add(manholeCacheKey(extraction.manholeId));
  }
  if (extraction.lampPostId) {
    add(lampCacheKey(extraction.lampPostId));
  }
  for (const query of extraction.geocodeQueries || []) {
    add(addressCacheKey(query));
  }

  return keys;
}

/**
 * All keys to persist after a successful geocode.
 */
function buildWriteEntries(normalizedInput, extraction, selectedAttempt, result) {
  const entries = [];
  const seen = new Set();

  function push(kind, cacheKey, queryText) {
    if (!cacheKey || seen.has(cacheKey)) {
      return;
    }
    seen.add(cacheKey);
    entries.push({ kind, cacheKey, queryText: queryText || null });
  }

  push("input", inputCacheKey(normalizedInput), normalizedInput);

  if (extraction?.manholeId) {
    push("manhole", manholeCacheKey(extraction.manholeId), extraction.manholeId);
  }
  if (extraction?.lampPostId) {
    push("lamp", lampCacheKey(extraction.lampPostId), extraction.lampPostId);
  }

  const queries = new Set(extraction?.geocodeQueries || []);
  if (selectedAttempt?.geocodeQuery) {
    queries.add(selectedAttempt.geocodeQuery);
  }
  for (const query of queries) {
    push("address", addressCacheKey(query), query);
  }

  const providerId = result?.providerId || result?.routing?.selectedProvider || null;
  const lat = result?.coordinate?.lat ?? null;
  const lng = result?.coordinate?.lng ?? null;

  return entries.map((entry) => ({
    ...entry,
    providerId,
    lat,
    lng,
  }));
}

module.exports = {
  normalizeAddress,
  hashNormalized,
  inputCacheKey,
  manholeCacheKey,
  lampCacheKey,
  addressCacheKey,
  cacheKeyForAddress,
  buildLookupKeys,
  buildWriteEntries,
};
