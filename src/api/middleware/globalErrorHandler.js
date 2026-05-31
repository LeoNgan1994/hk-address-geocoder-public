const { sendApiError } = require("../errors");

function notFoundHandler(req, res) {
  return res.status(404).json({
    error: "not_found",
    message: `找不到路由 ${req.method} ${req.path}`,
    source: "client",
    requestId: req.requestContext?.requestId || req.requestId || null,
  });
}

function globalErrorHandler(err, req, res, _next) {
  if (res.headersSent) {
    return;
  }

  const status = err.status || 500;
  const isKnown = err.name === "ApiError" || err.status;

  if (!isKnown) {
    console.error("[api] unhandled error", err);
  }

  if (err.status) {
    return sendApiError(res, req, err);
  }

  return sendApiError(res, req, {
    status: 500,
    error: "internal_error",
    message: "伺服器內部錯誤",
    source: "internal",
    details:
      process.env.NODE_ENV === "production" ? undefined : { message: err.message },
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
