const MAX_ATTEMPTS = 2;

function buildRequestMeta({
  fromCache = false,
  attempts = 0,
  requestFailed = false,
  retried = false,
  errorMessage = "",
} = {}) {
  return {
    fromCache,
    attempts,
    maxAttempts: MAX_ATTEMPTS,
    requestFailed,
    retried,
    errorMessage: requestFailed ? errorMessage : "",
  };
}

function attachRequestMeta(result, requestMeta) {
  return {
    ...result,
    request: requestMeta,
  };
}

module.exports = {
  MAX_ATTEMPTS,
  buildRequestMeta,
  attachRequestMeta,
};
