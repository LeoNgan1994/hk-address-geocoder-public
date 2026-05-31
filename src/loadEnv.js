/**
 * Load .env when present (local dev). Docker Compose injects env directly.
 */
function loadEnv() {
  try {
    require("dotenv").config();
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  const { configureOutboundProxy } = require("./net/configureProxy");
  const { validateOutboundConfig } = require("./net/outboundFetch");

  const proxy = configureOutboundProxy();
  process.env._OUTBOUND_PROXY_CONFIGURED = JSON.stringify(
    proxy.enabled
      ? {
          proxyUrl: proxy.proxyUrl,
          noProxy: proxy.noProxy || null,
          undiciMode: proxy.undiciMode || null,
          undici: proxy.undiciOk,
          globalAgent: proxy.globalAgentOk,
        }
      : { enabled: false, reason: proxy.reason || "no proxy env" }
  );

  const validation = validateOutboundConfig(proxy);
  process.env._OUTBOUND_CONFIG_VALIDATION = JSON.stringify(validation);

  if (validation.warnings.length > 0) {
    console.warn(
      JSON.stringify({ event: "outbound_config_warning", warnings: validation.warnings })
    );
  }
  if (validation.errors.length > 0) {
    console.error(
      JSON.stringify({ event: "outbound_config_error", errors: validation.errors })
    );
  }
}

module.exports = { loadEnv };
