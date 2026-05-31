/**
 * Future route: LLM-assisted entity extraction before routing.
 * Phase 1: disabled.
 */
async function normalizeWithLlm(_rawInput, _options = {}) {
  throw new Error(
    "LLM normalizer is not enabled. Set LLM_ENABLED=true and implement provider integration first."
  );
}

function isLlmNormalizerEnabled() {
  return process.env.LLM_ENABLED === "true" && Boolean(process.env.LLM_API_URL);
}

module.exports = {
  normalizeWithLlm,
  isLlmNormalizerEnabled,
};
