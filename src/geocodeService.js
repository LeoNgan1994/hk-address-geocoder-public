const addressCache = require("./cache/addressCache");
const geocodeCacheRepository = require("./db/geocodeCacheRepository");
const { formatErrorResult } = require("./formatGeocodeResult");
const { createLogger } = require("./logger");
const { buildRequestMeta, attachRequestMeta, MAX_ATTEMPTS } = require("./requestMeta");
const { routeGeocode } = require("./router/geocodeRouter");
const { PROVIDER_IDS } = require("./providers/providerIds");
const { extractFromText } = require("./extractor/locationExtractor");

function buildEntry(address, extra = {}) {
  return {
    id: extra.id ?? null,
    restaurantName: extra.restaurantName ?? "",
    address,
    ...extra,
  };
}

function formatFromCache(cachedEntry, entry) {
  const cachedResult = {
    ...cachedEntry.result,
    ...entry,
    address: entry.address || cachedEntry.address,
  };
  return attachRequestMeta(
    cachedResult,
    buildRequestMeta({
      fromCache: true,
      attempts: 0,
      requestFailed: false,
      retried: false,
    })
  );
}

function attachRoutingMeta(result, routingMeta, requestMeta) {
  return {
    ...attachRequestMeta(result, requestMeta),
    routing: routingMeta,
  };
}

function hasValidCoordinate(result) {
  if (!result || result.status !== "success") {
    return false;
  }
  const { lat, lng } = result.coordinate || {};
  return Number(lat) !== 0 && Number(lng) !== 0;
}

function createManholeLookupState(extraction) {
  if (!extraction.manholeId) {
    return { requested: false };
  }
  return {
    requested: true,
    manholeId: extraction.manholeId,
    found: false,
    reason: null,
    messageZh: null,
    triedLayers: [],
    networkType: null,
    featNum: null,
  };
}

function applyManholeMiss(state, miss) {
  if (!state.requested || !miss) {
    return state;
  }
  return {
    ...state,
    found: false,
    reason: miss.reason,
    messageZh: miss.messageZh,
    triedLayers: miss.triedLayers || [],
  };
}

function applyManholeHit(state, result) {
  if (!state.requested) {
    return state;
  }
  return {
    ...state,
    found: true,
    reason: null,
    messageZh: null,
    networkType: result.network_type || result.dataAcquisition || null,
    featNum: result.feat_num || state.manholeId,
  };
}

function stripAssetFallbackQuery(sanitized, extraction) {
  const assetIds = [extraction.manholeId, extraction.lampPostId].filter(Boolean);
  if (!sanitized || assetIds.length === 0) {
    return "";
  }
  let stripped = sanitized;
  for (const id of assetIds) {
    stripped = stripped.replace(new RegExp(id, "gi"), "");
  }
  return stripped
    .replace(/\bmanhole\b/gi, "")
    .replace(/燈柱/g, "")
    .replace(/\blamppost\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRouteAttempts(extraction) {
  const attempts = [];

  if (extraction.lampPostId) {
    attempts.push({
      kind: "lamp_post",
      geocodeQuery: extraction.lampPostId,
      routeOptions: {
        lampPostId: extraction.lampPostId,
        geocodeQuery: extraction.lampPostId,
        providersOnly: [PROVIDER_IDS.LAMP_POST],
        ignoreManhole: true,
      },
    });
  }

  const addressRouteOptions = (geocodeQuery) => ({
    geocodeQuery,
    ignoreManhole: Boolean(extraction.manholeId),
    ignoreLampPost: Boolean(extraction.lampPostId),
  });

  for (const query of extraction.geocodeQueries) {
    attempts.push({
      kind: "address",
      geocodeQuery: query,
      routeOptions: addressRouteOptions(query),
    });
  }

  const strippedFallback = stripAssetFallbackQuery(extraction.sanitized, extraction);
  if (
    strippedFallback &&
    !attempts.some(
      (item) => item.geocodeQuery.toLowerCase() === strippedFallback.toLowerCase()
    )
  ) {
    attempts.push({
      kind: "address-fallback",
      geocodeQuery: strippedFallback,
      routeOptions: addressRouteOptions(strippedFallback),
    });
  }

  return attempts;
}

function enrichWithExtraction(result, extraction, selectedAttempt, manholeLookup) {
  return {
    ...result,
    geocodeQuery: selectedAttempt?.geocodeQuery || extraction.primaryGeocodeQuery,
    remarks: extraction.remarks,
    manholeLookup,
    extraction: {
      manholeId: extraction.manholeId,
      laneId: extraction.laneId,
      remarks: extraction.remarks,
      geocodeQueries: extraction.geocodeQueries,
      candidates: extraction.candidates,
      selectedQuery: selectedAttempt?.geocodeQuery || null,
    },
  };
}

async function geocodeAddress(address, options = {}) {
  const {
    useCache = true,
    logger = createLogger({ sessionId: options.sessionId }),
    entry = {},
  } = options;

  const normalizedAddress = addressCache.normalizeAddress(address);
  if (!normalizedAddress) {
    const emptyError = new Error("Address is required.");
    logger.error("geocode_invalid_input", { address: "" });
    return attachRequestMeta(
      formatErrorResult(buildEntry("", entry), emptyError),
      buildRequestMeta({
        attempts: 0,
        requestFailed: true,
        errorMessage: emptyError.message,
      })
    );
  }

  const queryEntry = buildEntry(normalizedAddress, entry);
  const inputCacheKey = addressCache.cacheKeyForAddress(normalizedAddress);

  if (useCache && addressCache.isCacheEnabled()) {
    const cachedInput = await addressCache.get(normalizedAddress, null);
    if (cachedInput) {
      logger.info("cache_hit", {
        address: normalizedAddress,
        cacheKey: cachedInput.key,
        cacheKind: cachedInput.entry.kind,
        cachedAt: cachedInput.entry.cachedAt,
        phase: "input",
      });
      return formatFromCache(cachedInput.entry, queryEntry);
    }
  }

  const extraction = extractFromText(normalizedAddress);

  if (useCache && addressCache.isCacheEnabled()) {
    const cachedSemantic = await addressCache.get(normalizedAddress, extraction);
    if (cachedSemantic) {
      logger.info("cache_hit", {
        address: normalizedAddress,
        cacheKey: cachedSemantic.key,
        cacheKind: cachedSemantic.entry.kind,
        cachedAt: cachedSemantic.entry.cachedAt,
        phase: "semantic",
      });
      return formatFromCache(cachedSemantic.entry, queryEntry);
    }
    logger.info("cache_miss", {
      address: normalizedAddress,
      inputCacheKey,
      lookupKeys: addressCache.buildLookupKeys(normalizedAddress, extraction),
    });
  }
  const routeAttempts = buildRouteAttempts(extraction);
  let manholeLookup = createManholeLookupState(extraction);

  logger.info("geocode_request_start", {
    address: normalizedAddress,
    manholeId: extraction.manholeId,
    geocodeQueries: extraction.geocodeQueries,
    remarks: extraction.remarks,
  });

  let routed = null;
  let selectedAttempt = null;
  let totalAttempts = 0;

  for (const attempt of routeAttempts) {
    totalAttempts += 1;
    logger.info("geocode_attempt", {
      kind: attempt.kind,
      geocodeQuery: attempt.geocodeQuery,
    });

    const outcome = await routeGeocode(normalizedAddress, queryEntry, logger, attempt.routeOptions);
    routed = outcome;

    if (attempt.kind === "manhole" && outcome.manholeMiss) {
      manholeLookup = applyManholeMiss(manholeLookup, outcome.manholeMiss);
      logger.info("manhole_not_found", {
        manholeId: extraction.manholeId,
        reason: outcome.manholeMiss.reason,
      });
      continue;
    }

    if (attempt.kind === "lamp_post" && outcome.lampPostMiss) {
      logger.info("lamp_post_not_found", {
        lampPostId: extraction.lampPostId,
        reason: outcome.lampPostMiss.reason,
      });
      continue;
    }

    if (hasValidCoordinate(outcome.result)) {
      selectedAttempt = attempt;
      if (attempt.kind === "manhole") {
        manholeLookup = applyManholeHit(manholeLookup, outcome.result);
      }
      break;
    }
  }

  if (!routed) {
    routed = await routeGeocode(normalizedAddress, queryEntry, logger);
  }

  const routingMeta = {
    classifier: routed.queryContext?.classifier,
    hints: routed.queryContext?.hints,
    confidence: routed.queryContext?.confidence,
    triedProviders: routed.triedProviders,
    selectedProvider: routed.providerId,
    acquisitionMode: routed.acquisitionMode || routed.result?.dataAcquisition,
    entities: routed.queryContext?.entities,
    manholeLookup,
  };

  if (routed.error) {
    const failedResult = attachRoutingMeta(
      enrichWithExtraction(
        formatErrorResult(queryEntry, routed.error),
        extraction,
        selectedAttempt,
        manholeLookup
      ),
      routingMeta,
      buildRequestMeta({
        attempts: MAX_ATTEMPTS,
        requestFailed: true,
        retried: true,
        errorMessage: routed.error.message,
      })
    );
    logger.error("geocode_request_failed", {
      address: normalizedAddress,
      requestFailed: true,
      error: failedResult.request.errorMessage,
      triedProviders: routed.triedProviders,
    });
    return failedResult;
  }

  const result = attachRoutingMeta(
    enrichWithExtraction(routed.result, extraction, selectedAttempt, manholeLookup),
    routingMeta,
    buildRequestMeta({
      attempts: totalAttempts || routed.attempts || 1,
      requestFailed: false,
      retried: totalAttempts > 1,
    })
  );

  if (useCache && addressCache.isCacheEnabled() && hasValidCoordinate(result)) {
    const savedKeys = await addressCache.set(
      normalizedAddress,
      extraction,
      selectedAttempt,
      result
    );
    logger.info("cache_write", {
      address: normalizedAddress,
      cacheKeys: savedKeys,
      inputCacheKey,
      status: result.status,
      providerId: result.providerId || routed.providerId,
      ttlDays: geocodeCacheRepository.cacheTtlDays(),
    });
  }

  logger.info("geocode_success", {
    address: normalizedAddress,
    status: result.status,
    providerId: result.providerId || routed.providerId,
    geocodeQuery: result.geocodeQuery,
    manholeFound: manholeLookup.found,
    lat: result.coordinate?.lat,
    lng: result.coordinate?.lng,
  });

  return result;
}

async function createGeocodeService(options = {}) {
  const logger = options.logger || createLogger({ sessionId: options.sessionId });
  return {
    geocodeAddress: (addr, geocodeOptions = {}) =>
      geocodeAddress(addr, { ...geocodeOptions, logger, useCache: geocodeOptions.useCache ?? true }),
    logger,
    cacheCount: () => addressCache.count(),
    clearCache: () => addressCache.clearAll(),
    purgeExpiredCache: () => addressCache.purgeExpired(),
  };
}

module.exports = {
  geocodeAddress,
  createGeocodeService,
  buildRouteAttempts,
  stripAssetFallbackQuery,
  PROVIDER_IDS,
};
