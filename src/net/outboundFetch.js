/**
 * Outbound HTTP policy for public APIs (OGCIO / LandsD).
 * Do not call bare fetch() in clients; use fetchExternal().
 */
const { fetch } = require("undici");

function formatFetchError(error) {
  if (!error) {
    return "unknown error";
  }
  const parts = [error.message];
  let cause = error.cause;
  while (cause) {
    parts.push(`${cause.code || "error"}: ${cause.message}`);
    cause = cause.cause;
  }
  return parts.filter(Boolean).join(" | ");
}

async function fetchExternal(url, options = {}) {
  return fetch(url, options);
}

function validateOutboundConfig(proxySetup = {}) {
  const warnings = [];
  const errors = [];
  const proxyUrl =
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.https_proxy;

  if (proxyUrl && proxySetup.enabled && !proxySetup.undiciOk) {
    errors.push(
      "HTTP_PROXY is set but undici EnvHttpProxyAgent failed; fetch() may not use the proxy."
    );
  }

  if (proxyUrl && proxySetup.enabled && !proxySetup.globalAgentOk) {
    warnings.push(
      "global-agent failed to load; hk-address-parser paths may not use HTTP_PROXY."
    );
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    proxyEnabled: Boolean(proxyUrl),
  };
}

module.exports = {
  fetchExternal,
  formatFetchError,
  validateOutboundConfig,
};
