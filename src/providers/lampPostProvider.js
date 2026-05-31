const { formatLampPostResult } = require("../formatGeocodeResult");
const { PROVIDER_IDS } = require("./providerIds");
const { HINT } = require("../classifier/ruleClassifier");
const dataSourceMiddleware = require("../middleware/dataSourceMiddleware");

function canHandle(queryContext) {
  return Boolean(queryContext.entities?.lampPostId) || queryContext.hints.includes(HINT.LAMP_POST);
}

async function search(queryContext, entry, logger) {
  const lampPostId = queryContext.entities?.lampPostId;
  if (!lampPostId) {
    return { handled: false, providerId: PROVIDER_IDS.LAMP_POST };
  }

  logger.info("provider_request_start", {
    address: queryContext.normalized,
    providerId: PROVIDER_IDS.LAMP_POST,
    lampPostId,
  });

  const acquired = await dataSourceMiddleware.acquire(
    PROVIDER_IDS.LAMP_POST,
    { lampPostId },
    logger
  );

  if (!acquired.ok) {
    logger.warn("provider_no_match", {
      address: queryContext.normalized,
      providerId: PROVIDER_IDS.LAMP_POST,
      lampPostId,
      triedModes: acquired.triedModes,
      reason: acquired.reason,
    });
    return {
      handled: false,
      providerId: PROVIDER_IDS.LAMP_POST,
      lampPostMiss: {
        found: false,
        lampPostId,
        reason: acquired.reason || "LandsD 找不到此燈柱編號",
        messageZh: `找不到燈柱 ${lampPostId}`,
        triedModes: acquired.triedModes || [],
      },
    };
  }

  return {
    handled: true,
    result: formatLampPostResult(entry, acquired.record, acquired.acquisitionMode),
    providerId: PROVIDER_IDS.LAMP_POST,
    attempts: acquired.attempt || 1,
    acquisitionMode: acquired.acquisitionMode,
  };
}

module.exports = {
  id: PROVIDER_IDS.LAMP_POST,
  canHandle,
  search,
};
