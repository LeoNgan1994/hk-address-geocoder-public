const { ACQUISITION_MODE } = require("../types");
const { fetchLampPostById } = require("../../clients/lampPostApiClient");

const HANDLERS = {
  lamp_post_registry: fetchLampPostById,
};

async function acquireFromApi(providerId, query) {
  const handler = HANDLERS[providerId];
  if (!handler) {
    return { ok: false, reason: `no API handler for ${providerId}` };
  }
  const outcome = await handler(query.lampPostId);
  if (!outcome.ok) {
    return outcome;
  }
  return {
    ok: true,
    record: { ...outcome.record, acquisitionMode: ACQUISITION_MODE.API },
    attempt: outcome.attempt,
    url: outcome.url,
  };
}

module.exports = {
  acquireFromApi,
};
