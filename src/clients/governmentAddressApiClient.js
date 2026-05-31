const { fetchExternal } = require("../net/outboundFetch");
const { hk1980ToWgs84 } = require("../utils/projConvert");
const { formatGovernmentLandsdMatch, formatNoMatchResult } = require("../formatGeocodeResult");
const {
  applyStreetFirstPick,
  filterRecordsByBuildingKeywords,
  mergeRecordsByCoordinate,
  planStreetFirstSearch,
} = require("./landsdRecordPicker");
const { PROVIDER_IDS } = require("../providers/providerIds");
const { MAX_ATTEMPTS } = require("../requestMeta");

const RETRY_DELAY_MS = 400;
const DEFAULT_LANDSD_BASE = "https://www.map.gov.hk/gs/api/v1.0.0";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function landsdBaseUrl() {
  return (process.env.GOVERNMENT_LANDSD_BASE_URL || DEFAULT_LANDSD_BASE).replace(/\/$/, "");
}

function shouldUseNativeFetch() {
  if (process.env.GOVERNMENT_USE_PARSER === "true") {
    return false;
  }
  if (process.env.GOVERNMENT_USE_NATIVE_FETCH === "false") {
    return false;
  }
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    return true;
  }
  return process.env.GOVERNMENT_USE_NATIVE_FETCH === "true";
}

function normalizeLandRecord(item, rankIndex = 0) {
  const x = Number(item.x ?? item.X);
  const y = Number(item.y ?? item.Y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const coordinate = hk1980ToWgs84(x, y);
  return {
    coordinate,
    coordinateHk1980: { x, y, crs: "EPSG:2326" },
    matchedAddressZh: item.addressZH || item.addressTC || item.AddressZH || "",
    matchedAddressEn: item.addressEN || item.AddressEN || "",
    nameZH: item.nameZH || item.NameZH || "",
    nameEN: item.nameEN || item.NameEN || "",
    score: item.score ?? item.Score ?? null,
    _rankIndex: rankIndex,
  };
}

async function fetchLocationSearch(address) {
  const url = `${landsdBaseUrl()}/locationSearch?q=${encodeURIComponent(address)}`;
  const response = await fetchExternal(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS || 30000)),
  });
  if (!response.ok) {
    throw new Error(`LandsD locationSearch HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((item, index) => normalizeLandRecord(item, index))
    .filter(Boolean);
}

async function fetchStreetFirstLocationSearch(geocodeQuery, originalInput) {
  const plan = planStreetFirstSearch(geocodeQuery, originalInput);
  const queries = [];
  let strategy = "street_only";
  let allRecords = [];

  if (!plan.street) {
    const fallback = String(originalInput || "").trim();
    if (!fallback) {
      return { records: [], queries, strategy: "empty", plan };
    }
    queries.push(fallback);
    const records = await fetchLocationSearch(fallback);
    return { records, allRecords: records, queries, strategy: "original_only", plan };
  }

  queries.push(plan.street);
  let streetRecords = await fetchLocationSearch(plan.street);
  allRecords = streetRecords;

  if (plan.hasBuildingCue) {
    const poolMatches = filterRecordsByBuildingKeywords(
      streetRecords,
      plan.buildingNames
    );
    if (poolMatches.length > 0) {
      return {
        records: poolMatches,
        allRecords: streetRecords,
        queries,
        strategy: "street_pool_match",
        plan,
      };
    }

    for (const query of plan.fallbackQueries) {
      queries.push(query);
      const batch = await fetchLocationSearch(query);
      allRecords = mergeRecordsByCoordinate(allRecords, batch);
      const matches = filterRecordsByBuildingKeywords(batch, plan.buildingNames);
      if (matches.length > 0) {
        return {
          records: matches,
          allRecords,
          queries,
          strategy: "fallback_query_match",
          plan,
        };
      }
    }

    strategy = "street_no_building_match";
  }

  return {
    records: streetRecords,
    allRecords,
    queries,
    strategy,
    plan,
  };
}

async function fetchMergedLocationSearch(geocodeQuery, originalInput) {
  const resolved = await fetchStreetFirstLocationSearch(geocodeQuery, originalInput);
  return {
    records: resolved.records,
    queries: resolved.queries,
    strategy: resolved.strategy,
    allRecords: resolved.allRecords,
    plan: resolved.plan,
  };
}

async function searchAddressWithFetch(geocodeQuery, entry, logger) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      logger.info("provider_request_start", {
        address: geocodeQuery,
        providerId: PROVIDER_IDS.GOVERNMENT,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        acquisitionMode: "api",
        client: "native-fetch",
      });

      const originalInput = entry.address || geocodeQuery;
      const { records, queries, strategy, allRecords } = await fetchMergedLocationSearch(
        geocodeQuery,
        originalInput
      );

      if (!records.length) {
        return {
          handled: true,
          result: formatNoMatchResult(entry),
          providerId: PROVIDER_IDS.GOVERNMENT,
          attempts: attempt,
          acquisitionMode: "api",
        };
      }

      const pick = applyStreetFirstPick(records, {
        geocodeQuery,
        originalInput,
      }, { strategy, queries });
      const best = pick.best;

      logger.info("landsd_record_picked", {
        geocodeQuery,
        landsdQueries: queries,
        landsdStrategy: strategy,
        poolSize: pick.poolSize,
        matchedPoolSize: pick.matchedPoolSize,
        pickedAddressZh: best.matchedAddressZh,
        pickedNameZh: best.nameZH,
        matchCount: records.length,
        topCandidates: pick.ranked,
      });

      const result = formatGovernmentLandsdMatch(entry, best, records.length);
      result.landsdQueries = queries;
      result.landsdStrategy = strategy;
      result.landsdCandidates = pick.ranked;

      return {
        handled: true,
        result,
        providerId: PROVIDER_IDS.GOVERNMENT,
        attempts: attempt,
        acquisitionMode: "api",
      };
    } catch (error) {
      lastError = error;
      logger.warn("provider_attempt_failed", {
        address: geocodeQuery,
        providerId: PROVIDER_IDS.GOVERNMENT,
        attempt,
        client: "native-fetch",
        error: error.message,
      });
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  return {
    handled: false,
    error: lastError,
    providerId: PROVIDER_IDS.GOVERNMENT,
    attempts: MAX_ATTEMPTS,
  };
}

module.exports = {
  shouldUseNativeFetch,
  searchAddressWithFetch,
  fetchLocationSearch,
  fetchStreetFirstLocationSearch,
};
