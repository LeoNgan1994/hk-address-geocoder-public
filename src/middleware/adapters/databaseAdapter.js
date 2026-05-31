const { ACQUISITION_MODE } = require("../types");
const lampPostRepository = require("../../db/lampPostRepository");

async function fetchLampPostFromDatabase(lampPostId) {
  const record = await lampPostRepository.findByLampPostId(lampPostId);
  if (!record) {
    return { ok: false, reason: "not found in database" };
  }
  return {
    ok: true,
    record: { ...record, acquisitionMode: ACQUISITION_MODE.DATABASE },
  };
}

const HANDLERS = {
  lamp_post_registry: fetchLampPostFromDatabase,
};

async function acquireFromDatabase(providerId, query) {
  const handler = HANDLERS[providerId];
  if (!handler) {
    return { ok: false, reason: `no database handler for ${providerId}` };
  }
  return handler(query.lampPostId);
}

module.exports = {
  acquireFromDatabase,
};
