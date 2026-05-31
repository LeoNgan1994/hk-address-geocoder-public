/**
 * Public API — for CLI, batch tests, and future frontend/HTTP layer.
 */
const { geocodeAddress, createGeocodeService, PROVIDER_IDS } = require("./geocodeService");
const { createLogger } = require("./logger");
const addressCache = require("./cache/addressCache");
const { buildSourceAttribution, buildSourceFromProviderKey, SOURCE_REGISTRY, PROVIDER_SOURCE_REGISTRY } = require("./sourceRegistry");
const { bootstrap } = require("./bootstrap");
const { routeGeocode, buildQueryContext } = require("./router/geocodeRouter");
const { classify } = require("./classifier/ruleClassifier");
const { extractFromText } = require("./extractor/locationExtractor");
const dataSourceMiddleware = require("./middleware/dataSourceMiddleware");
const { DATA_SOURCE_REGISTRY } = require("./config/dataSources");
const { PROVIDERS } = require("./providers");

module.exports = {
  geocodeAddress,
  createGeocodeService,
  createLogger,
  addressCache,
  bootstrap,
  routeGeocode,
  buildQueryContext,
  classify,
  extractFromText,
  buildSourceAttribution,
  buildSourceFromProviderKey,
  SOURCE_REGISTRY,
  PROVIDER_SOURCE_REGISTRY,
  PROVIDER_IDS,
  PROVIDERS,
  dataSourceMiddleware,
  DATA_SOURCE_REGISTRY,
};
