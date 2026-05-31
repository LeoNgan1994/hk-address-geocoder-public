const crypto = require("crypto");

function firstForwardedIp(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  return value.split(",")[0].trim() || null;
}

function buildRequestContext(req) {
  const forwarded = firstForwardedIp(req.headers["x-forwarded-for"]);
  const clientIp =
    forwarded ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    req.ip ||
    null;

  const auth = req.auth || {
    mode: "unknown",
    keyId: null,
    keyName: null,
    isAdmin: false,
  };

  return {
    requestId: req.requestId || crypto.randomUUID(),
    clientIp: typeof clientIp === "string" ? clientIp.replace(/^::ffff:/, "") : clientIp,
    userAgent: req.headers["user-agent"] || null,
    referer: req.headers.referer || req.headers.referrer || null,
    httpMethod: req.method,
    httpPath: req.originalUrl || req.url,
    authMode: auth.mode,
    apiKeyId: auth.keyId || null,
    apiKeyName: auth.keyName || null,
    isAdmin: Boolean(auth.isAdmin),
  };
}

function attachRequestContext(req, _res, next) {
  if (!req.requestId) {
    req.requestId = crypto.randomUUID();
  }
  req.requestContext = buildRequestContext(req);
  next();
}

function mergeRequestContext(baseContext, extra = {}) {
  if (!baseContext) {
    return extra;
  }
  return { ...baseContext, ...extra };
}

module.exports = {
  buildRequestContext,
  attachRequestContext,
  mergeRequestContext,
};
