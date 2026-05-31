const { createLogger } = require("../../logger");
const { buildRequestContext } = require("../requestContext");

function accessLogMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const context = req.requestContext || buildRequestContext(req);
    const logger = createLogger({
      sessionId: context.requestId,
      requestContext: context,
    });

    logger.info("api_access", {
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      contentLength: Number(res.getHeader("content-length")) || null,
    });
  });

  next();
}

module.exports = {
  accessLogMiddleware,
};
