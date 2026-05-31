const { DATA_SOURCE_REGISTRY } = require("../config/dataSources");
const { ACQUISITION_MODE } = require("./types");
const { acquireFromApi } = require("./adapters/apiAdapter");
const { acquireFromDatabase } = require("./adapters/databaseAdapter");

function isModeEnabled(providerConfig, mode) {
  const modeConfig = providerConfig.modes[mode];
  return Boolean(modeConfig && modeConfig.enabled());
}

async function tryAcquisitionMode(mode, providerId, query, logger) {
  if (mode === ACQUISITION_MODE.API) {
    logger.info("datasource_try_api", { providerId, query });
    return acquireFromApi(providerId, query);
  }
  if (mode === ACQUISITION_MODE.DATABASE) {
    logger.info("datasource_try_database", { providerId, query });
    return acquireFromDatabase(providerId, query);
  }
  return { ok: false, reason: `unsupported mode: ${mode}` };
}

/**
 * Middleware: resolve records by configured acquisition order (api / database / ...).
 */
async function acquire(providerId, query, logger) {
  const providerConfig = DATA_SOURCE_REGISTRY[providerId];
  if (!providerConfig) {
    return { ok: false, reason: `unknown provider: ${providerId}` };
  }

  const order = providerConfig.acquisitionOrder();
  const triedModes = [];

  for (const mode of order) {
    if (!isModeEnabled(providerConfig, mode)) {
      logger.info("datasource_mode_skipped", { providerId, mode, reason: "disabled" });
      continue;
    }

    triedModes.push(mode);
    const outcome = await tryAcquisitionMode(mode, providerId, query, logger);
    if (outcome.ok) {
      logger.info("datasource_acquired", {
        providerId,
        mode,
        triedModes,
        acquisitionMode: outcome.record?.acquisitionMode,
      });
      return {
        ok: true,
        record: outcome.record,
        acquisitionMode: mode,
        triedModes,
        attempt: outcome.attempt,
        url: outcome.url,
      };
    }

    logger.warn("datasource_mode_miss", {
      providerId,
      mode,
      reason: outcome.reason,
    });
  }

  return {
    ok: false,
    reason: "all configured acquisition modes failed",
    triedModes,
  };
}

const { toPublicProviderId } = require("../api/publicProviderNames");

function listProviderCapabilities() {
  return Object.values(DATA_SOURCE_REGISTRY).map((item) => ({
    providerId: toPublicProviderId(item.providerId),
    labelZh: item.labelZh,
    acquisitionOrder: item.acquisitionOrder(),
    modes: Object.fromEntries(
      Object.entries(item.modes).map(([mode, cfg]) => [mode, cfg.enabled()])
    ),
  }));
}

module.exports = {
  acquire,
  listProviderCapabilities,
};
