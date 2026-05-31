/**
 * LLM extension points (Phase 2+). Not used in Phase 1.
 *
 * Route A: llmNormalizer — extract entities from messy text
 * Route B: llmClassifier — disambiguate provider when rule confidence is low
 */
const llmClassifier = require("./stubs/llmClassifier.stub");
const llmNormalizer = require("./stubs/llmNormalizer.stub");

const LLM_ROUTES = {
  NORMALIZER: "llm_normalizer",
  CLASSIFIER: "llm_classifier",
};

function getLlmRouteStatus() {
  return {
    enabled: process.env.LLM_ENABLED === "true",
    routes: LLM_ROUTES,
    classifierReady: llmClassifier.isLlmClassifierEnabled(),
    normalizerReady: llmNormalizer.isLlmNormalizerEnabled(),
  };
}

module.exports = {
  LLM_ROUTES,
  getLlmRouteStatus,
  ...llmClassifier,
  ...llmNormalizer,
};
