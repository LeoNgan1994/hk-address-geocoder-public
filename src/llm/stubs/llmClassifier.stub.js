/**
 * Future route: LLM-assisted classification for messy natural language.
 * Phase 1: disabled — router must not call this unless LLM_ENABLED=true.
 */
async function classifyWithLlm(_rawInput, _options = {}) {
  throw new Error(
    "LLM classifier is not enabled. Set LLM_ENABLED=true and implement provider integration first."
  );
}

function isLlmClassifierEnabled() {
  return process.env.LLM_ENABLED === "true" && Boolean(process.env.LLM_API_URL);
}

module.exports = {
  classifyWithLlm,
  isLlmClassifierEnabled,
};
