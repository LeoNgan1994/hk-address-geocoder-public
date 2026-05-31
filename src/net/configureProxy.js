/**
 * Route outbound HTTP(S) through HTTP_PROXY / HTTPS_PROXY.
 * - undici EnvHttpProxyAgent: Node fetch() — honors NO_PROXY
 * - global-agent: hk-address-parser-lib (bundled node-fetch / http.request)
 */
function configureOutboundProxy() {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (!proxyUrl) {
    return { enabled: false, reason: "no proxy env" };
  }

  const noProxy = process.env.NO_PROXY || process.env.no_proxy || "";

  let undiciOk = false;
  let globalAgentOk = false;

  try {
    const { setGlobalDispatcher, EnvHttpProxyAgent } = require("undici");
    setGlobalDispatcher(
      new EnvHttpProxyAgent({
        httpProxy: process.env.HTTP_PROXY || process.env.http_proxy || proxyUrl,
        httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy || proxyUrl,
        noProxy: noProxy || undefined,
      })
    );
    undiciOk = true;
  } catch (error) {
    console.error(
      "[proxy] undici EnvHttpProxyAgent failed (fetch() will not use proxy):",
      error.message
    );
  }

  try {
    process.env.GLOBAL_AGENT_HTTP_PROXY = proxyUrl;
    process.env.GLOBAL_AGENT_HTTPS_PROXY = proxyUrl;
    if (noProxy) {
      process.env.GLOBAL_AGENT_NO_PROXY = noProxy;
    }
    require("global-agent/bootstrap");
    globalAgentOk = true;
  } catch (error) {
    console.error("[proxy] global-agent failed:", error.message);
  }

  if (!undiciOk && !globalAgentOk) {
    return {
      enabled: false,
      reason: "proxy modules failed to load",
      proxyUrl,
      noProxy: noProxy || null,
      undiciOk,
      globalAgentOk,
    };
  }

  return {
    enabled: true,
    proxyUrl,
    noProxy: noProxy || null,
    undiciMode: "EnvHttpProxyAgent",
    undiciOk,
    globalAgentOk,
  };
}

module.exports = {
  configureOutboundProxy,
};
