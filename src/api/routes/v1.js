const express = require("express");
const { geocodeAddress } = require("../../geocodeService");
const { createLogger } = require("../../logger");
const { formatResolveResponse } = require("../formatResolveResponse");
const { apiKeyAuth } = require("../middleware/apiKeyAuth");
const { attachRequestContext } = require("../requestContext");
const { accessLogMiddleware } = require("../middleware/accessLog");
const { requestTimeoutMiddleware } = require("../middleware/requestTimeout");
const { rateLimitMiddleware } = require("../middleware/rateLimit");
const { responseHeadersMiddleware } = require("../middleware/responseHeaders");
const { createAdminKeysRouter } = require("./adminKeys");
const { buildCapabilitiesPayload } = require("../capabilitiesBuilder");
const { buildResolveHttpOutcome } = require("../resolveHttpOutcome");
const { asyncHandler, formatErrorBody } = require("../errors");
const { validateInputText } = require("../../lib/logSanitize");

function createV1Router() {
  const router = express.Router();

  router.use(attachRequestContext);
  router.use(responseHeadersMiddleware);
  router.use(requestTimeoutMiddleware);
  router.use(accessLogMiddleware);
  router.use(apiKeyAuth);
  router.use(rateLimitMiddleware);

  router.use("/admin/keys", createAdminKeysRouter());

  router.post(
    "/resolve",
    asyncHandler(async (req, res) => {
      const rawText = req.body?.text ?? req.body?.address;
      const validated = validateInputText(rawText, "text 或 address");
      if (!validated.ok) {
        return res
          .status(400)
          .json(
            formatErrorBody(req, {
              error: validated.error,
              message: validated.message,
              source: validated.source,
              details: validated.details,
            })
          );
      }

      const useCache = req.body?.useCache !== false;
      const includeDetail = req.query.detail === "1" || req.body?.detail === true;

      const logger = createLogger({
        sessionId: req.requestContext?.requestId || `api-v1-${Date.now()}`,
        requestContext: req.requestContext,
      });

      const fullResult = await geocodeAddress(validated.value, { useCache, logger });
      const payload = formatResolveResponse(fullResult, validated.value, { includeDetail });
      const outcome = buildResolveHttpOutcome(fullResult, payload);

      if (outcome.status === 200) {
        return res.status(200).json({
          ...outcome.body,
          requestId: req.requestContext?.requestId,
        });
      }

      return res.status(outcome.status).json({
        ...formatErrorBody(req, outcome),
        input: validated.value,
        status: payload.status,
        provider: payload.provider,
        geocodeQuery: payload.geocodeQuery,
        manhole: payload.manhole,
        matchedAddressZh: payload.matchedAddressZh,
        matchedAddressEn: payload.matchedAddressEn,
      });
    })
  );

  router.get(
    "/capabilities",
    asyncHandler(async (_req, res) => {
      res.json(buildCapabilitiesPayload());
    })
  );

  return router;
}

module.exports = {
  createV1Router,
};
