const { ApiError } = require("../errors");

function getRequestTimeoutMs() {
  const n = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

function requestTimeoutMiddleware(req, res, next) {
  const ms = getRequestTimeoutMs();
  req.requestTimeoutMs = ms;

  const timer = setTimeout(() => {
    if (res.headersSent) {
      return;
    }
    next(
      new ApiError(504, "request_timeout", `請求處理超過 ${ms}ms 上限`, "internal", {
        timeoutMs: ms,
        path: req.originalUrl,
      })
    );
  }, ms);

  const clear = () => clearTimeout(timer);
  res.on("finish", clear);
  res.on("close", clear);

  next();
}

module.exports = {
  requestTimeoutMiddleware,
  getRequestTimeoutMs,
};
