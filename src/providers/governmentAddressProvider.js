const {
  formatMatchResult,
  formatNoMatchResult,
} = require("../formatGeocodeResult");
const { loadParserModule, getLanguageEnum } = require("../loadParser");
const {
  shouldUseNativeFetch,
  searchAddressWithFetch,
} = require("../clients/governmentAddressApiClient");
const { PROVIDER_IDS } = require("./providerIds");

const RETRY_DELAY_MS = 400;
const MAX_ATTEMPTS = 2;

let parserSingleton = null;
let languagesSingleton = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureParser() {
  if (!parserSingleton) {
    parserSingleton = await loadParserModule();
    languagesSingleton = getLanguageEnum(parserSingleton);
  }
  return { parser: parserSingleton, languages: languagesSingleton };
}

function canHandle() {
  return true;
}

async function searchWithParser(queryContext, entry, logger) {
  const { parser, languages } = await ensureParser();
  const address = queryContext.normalized;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      logger.info("provider_request_start", {
        address,
        providerId: PROVIDER_IDS.GOVERNMENT,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        client: "hk-address-parser-lib",
      });

      const matches = await parser.parse(address);
      if (!Array.isArray(matches) || matches.length === 0) {
        return {
          handled: true,
          result: formatNoMatchResult(entry),
          providerId: PROVIDER_IDS.GOVERNMENT,
          attempts: attempt,
        };
      }

      return {
        handled: true,
        result: formatMatchResult(entry, matches[0], matches.length, languages),
        providerId: PROVIDER_IDS.GOVERNMENT,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      logger.warn("provider_attempt_failed", {
        address,
        providerId: PROVIDER_IDS.GOVERNMENT,
        attempt,
        client: "hk-address-parser-lib",
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

async function search(queryContext, entry, logger) {
  const geocodeQuery = queryContext.normalized;

  if (shouldUseNativeFetch()) {
    logger.info("government_address_client", { mode: "native-fetch" });
    return searchAddressWithFetch(geocodeQuery, entry, logger);
  }

  logger.info("government_address_client", { mode: "hk-address-parser-lib" });
  return searchWithParser(queryContext, entry, logger);
}

module.exports = {
  id: PROVIDER_IDS.GOVERNMENT,
  canHandle,
  search,
  MAX_ATTEMPTS,
};
