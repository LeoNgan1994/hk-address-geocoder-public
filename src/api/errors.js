/**
 * Unified API error shape.
 * source: client | auth | rate_limit | resolver | upstream | internal
 */
class ApiError extends Error {
  constructor(status, error, message, source = "internal", details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.error = error;
    this.source = source;
    this.details = details;
  }
}

function getRequestId(req) {
  return req.requestContext?.requestId || req.requestId || null;
}

function formatErrorBody(req, { error, message, source, details }) {
  const body = {
    error,
    message,
    source,
    requestId: getRequestId(req),
  };
  if (details && Object.keys(details).length > 0) {
    body.details = details;
  }
  return body;
}

function sendApiError(res, req, apiError) {
  const status = apiError.status || 500;
  return res.status(status).json(
    formatErrorBody(req, {
      error: apiError.error || "internal_error",
      message: apiError.message || String(apiError.message || "伺服器錯誤"),
      source: apiError.source || "internal",
      details: apiError.details ?? undefined,
    })
  );
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  ApiError,
  getRequestId,
  formatErrorBody,
  sendApiError,
  asyncHandler,
};
