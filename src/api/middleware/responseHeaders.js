const { getRequestId } = require("../errors");

function responseHeadersMiddleware(req, res, next) {
  const requestId = getRequestId(req);
  if (requestId) {
    res.setHeader("X-Request-Id", requestId);
  }
  next();
}

module.exports = {
  responseHeadersMiddleware,
};
