const ruleClassifier = require("../classifier/ruleClassifier");
const { getProviderById } = require("../providers");
const { formatErrorResult } = require("../formatGeocodeResult");

async function buildQueryContext(rawInput, options = {}) {
  return ruleClassifier.classify(rawInput, options);
}

async function runProvider(providerId, queryContext, entry, logger) {
  const provider = getProviderById(providerId);
  if (!provider) {
    return { handled: false };
  }
  if (!provider.canHandle(queryContext)) {
    return { handled: false, providerId };
  }
  return provider.search(queryContext, entry, logger);
}

async function routeGeocode(rawInput, entry, logger, routeOptions = {}) {
  const queryContext = await buildQueryContext(rawInput, routeOptions);

  logger.info("router_classified", {
    address: queryContext.normalized,
    classifier: queryContext.classifier,
    hints: queryContext.hints,
    confidence: queryContext.confidence,
    primaryProvider: queryContext.routing?.primaryProvider,
  });

  let chain = [
    queryContext.routing?.primaryProvider,
    ...(queryContext.routing?.fallbackProviders || []),
  ].filter(Boolean);

  if (Array.isArray(routeOptions.providersOnly) && routeOptions.providersOnly.length > 0) {
    chain = routeOptions.providersOnly;
  }

  const triedProviders = [];
  let lastProviderError = null;
  let manholeMiss = null;
  let lampPostMiss = null;

  for (const providerId of chain) {
    triedProviders.push(providerId);
    const outcome = await runProvider(providerId, queryContext, entry, logger);
    if (outcome.handled && outcome.result) {
      return {
        queryContext,
        result: outcome.result,
        providerId: outcome.providerId,
        attempts: outcome.attempts,
        triedProviders,
        acquisitionMode: outcome.acquisitionMode,
      };
    }
    if (outcome.manholeMiss) {
      manholeMiss = outcome.manholeMiss;
    }
    if (outcome.lampPostMiss) {
      lampPostMiss = outcome.lampPostMiss;
    }
    if (outcome.error) {
      lastProviderError = outcome.error;
    }
  }

  if (lastProviderError) {
    return {
      queryContext,
      error: lastProviderError,
      triedProviders,
      manholeMiss,
      lampPostMiss,
    };
  }

  return {
    queryContext,
    result: formatErrorResult(entry, new Error("No provider could resolve this query")),
    triedProviders,
    manholeMiss,
    lampPostMiss,
  };
}

module.exports = {
  routeGeocode,
  buildQueryContext,
};
