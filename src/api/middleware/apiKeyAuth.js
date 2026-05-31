const { isApiKeyEnabled } = require("../../auth/apiKeyConfig");
const { validateApiKey } = require("../../auth/apiKeyService");
const { ApiError } = require("../errors");

function extractApiKey(req) {
  const headerKey = req.headers["x-api-key"];
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const provided = headerKey || bearer;
  return provided && typeof provided === "string" ? provided.trim() : null;
}

function buildAnonymousAuth() {
  return {
    mode: "anonymous",
    keyId: null,
    keyName: "anonymous",
    isAdmin: false,
    source: "none",
  };
}

async function apiKeyAuth(req, res, next) {
  const provided = extractApiKey(req);

  if (!isApiKeyEnabled()) {
    if (provided) {
      const auth = await validateApiKey(provided);
      req.auth = auth || buildAnonymousAuth();
    } else {
      req.auth = buildAnonymousAuth();
    }
    return next();
  }

  if (!provided) {
    return next(
      new ApiError(
        401,
        "unauthorized",
        "請提供有效的 X-API-Key 或 Authorization: Bearer",
        "auth"
      )
    );
  }

  const auth = await validateApiKey(provided);
  if (!auth) {
    return next(
      new ApiError(401, "unauthorized", "API Key 無效、已停用或已過期", "auth")
    );
  }

  req.auth = auth;
  return next();
}

async function adminAuth(req, res, next) {
  const provided = extractApiKey(req);
  if (!provided) {
    return next(
      new ApiError(
        401,
        "unauthorized",
        "管理 API 需提供管理員 X-API-Key 或 Bearer",
        "auth"
      )
    );
  }

  const auth = await validateApiKey(provided);
  if (!auth?.isAdmin) {
    return next(
      new ApiError(403, "forbidden", "需要管理員 API Key", "auth")
    );
  }

  req.auth = auth;
  return next();
}

module.exports = {
  extractApiKey,
  apiKeyAuth,
  adminAuth,
};
